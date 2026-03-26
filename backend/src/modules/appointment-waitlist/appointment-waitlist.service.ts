import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import {
  AppointmentWaitlistEntry,
  AppointmentType,
} from './entities/appointment-waitlist-entry.entity';
import { CreateAppointmentWaitlistEntryDto } from './dto/create-appointment-waitlist-entry.dto';
import { UpdateAppointmentWaitlistEntryDto } from './dto/update-appointment-waitlist-entry.dto';
import { PetsService } from '../pets/pets.service';
import { VetClinicsService } from '../vet-clinics/vet-clinics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/entities/notification.entity';
import { Appointment } from '../vet-clinics/entities/appointment.entity';

const DEFAULT_EXPIRY_DAYS = 30;

@Injectable()
export class AppointmentWaitlistService {
  private readonly logger = new Logger(AppointmentWaitlistService.name);

  constructor(
    @InjectRepository(AppointmentWaitlistEntry)
    private readonly waitlistRepo: Repository<AppointmentWaitlistEntry>,
    private readonly petsService: PetsService,
    private readonly vetClinicsService: VetClinicsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Join the waitlist (create entry).
   */
  async join(dto: CreateAppointmentWaitlistEntryDto): Promise<AppointmentWaitlistEntry> {
    await this.petsService.findOne(dto.petId);
    await this.vetClinicsService.findOne(dto.vetClinicId);

    const existing = await this.waitlistRepo.findOne({
      where: {
        petId: dto.petId,
        vetClinicId: dto.vetClinicId,
      },
    });

    if (existing) {
      if (new Date(existing.expiresAt) > new Date()) {
        throw new BadRequestException(
          'This pet is already on the waitlist for this clinic',
        );
      }
      await this.waitlistRepo.remove(existing);
    }

    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : this.defaultExpiresAt();

    const entry = this.waitlistRepo.create({
      petId: dto.petId,
      vetClinicId: dto.vetClinicId,
      priority: dto.priority ?? 0,
      preferredType: dto.preferredType ?? null,
      expiresAt,
    });

    return await this.waitlistRepo.save(entry);
  }

  /**
   * Remove from waitlist.
   */
  async remove(id: string): Promise<void> {
    const entry = await this.findOne(id);
    await this.waitlistRepo.remove(entry);
  }

  /**
   * Get a single entry.
   */
  async findOne(id: string): Promise<AppointmentWaitlistEntry> {
    const entry = await this.waitlistRepo.findOne({
      where: { id },
      relations: ['pet', 'vetClinic'],
    });
    if (!entry) {
      throw new NotFoundException(`Waitlist entry ${id} not found`);
    }
    return entry;
  }

  /**
   * Update priority or expiry.
   */
  async update(
    id: string,
    dto: UpdateAppointmentWaitlistEntryDto,
  ): Promise<AppointmentWaitlistEntry> {
    const entry = await this.findOne(id);
    if (dto.priority !== undefined) entry.priority = dto.priority;
    if (dto.expiresAt !== undefined) entry.expiresAt = new Date(dto.expiresAt);
    return await this.waitlistRepo.save(entry);
  }

  /**
   * List waitlist entries, optionally filtered by clinic or pet.
   */
  async findAll(opts?: {
    vetClinicId?: string;
    petId?: string;
    includeExpired?: boolean;
  }): Promise<AppointmentWaitlistEntry[]> {
    const qb = this.waitlistRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.pet', 'pet')
      .leftJoinAndSelect('e.vetClinic', 'vetClinic')
      .orderBy('e.priority', 'ASC')
      .addOrderBy('e.createdAt', 'ASC');

    if (opts?.vetClinicId) {
      qb.andWhere('e.vetClinicId = :vetClinicId', {
        vetClinicId: opts.vetClinicId,
      });
    }
    if (opts?.petId) {
      qb.andWhere('e.petId = :petId', { petId: opts.petId });
    }
    if (!opts?.includeExpired) {
      qb.andWhere('e.expiresAt > :now', { now: new Date() });
    }

    return await qb.getMany();
  }

  /**
   * Called when an appointment is cancelled. Notifies waitlist users with matching clinic (and optionally type).
   */
  async notifyOnSlotAvailable(
    vetClinicId: string,
    cancelledAppointment: Appointment,
  ): Promise<number> {
    const now = new Date();
    const qb = this.waitlistRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.pet', 'pet')
      .where('e.vetClinicId = :vetClinicId', { vetClinicId })
      .andWhere('e.expiresAt > :now', { now })
      .orderBy('e.priority', 'ASC')
      .addOrderBy('e.createdAt', 'ASC');

    if (cancelledAppointment.type) {
      qb.andWhere(
        '(e.preferredType IS NULL OR e.preferredType = :type)',
        { type: cancelledAppointment.type },
      );
    }

    const entries = await qb.getMany();
    let notified = 0;

    for (const entry of entries) {
      const pet = await this.petsService.findOne(entry.petId);
      const userId = pet.ownerId;
      if (!userId) continue;

      const clinic = await this.vetClinicsService.findOne(vetClinicId);
      const title = 'Appointment slot available';
      const message = `A slot opened at ${clinic.name}. Your pet was on the waitlist — book now before it fills up.`;

      await this.notificationsService.create({
        userId,
        title,
        message,
        category: NotificationCategory.APPOINTMENT,
        actionUrl: `/appointments?clinic=${vetClinicId}`,
        metadata: {
          vetClinicId,
          petId: entry.petId,
          cancelledAppointmentId: cancelledAppointment.id,
          waitlistEntryId: entry.id,
        },
      });

      entry.notifiedAt = now;
      await this.waitlistRepo.save(entry);
      notified++;
    }

    if (notified > 0) {
      this.logger.log(
        `Notified ${notified} waitlist entries for clinic ${vetClinicId} (cancelled appointment ${cancelledAppointment.id})`,
      );
    }

    return notified;
  }

  /**
   * Remove expired waitlist entries (runs daily).
   */
  @Cron('0 0 * * *')
  async cleanupExpired(): Promise<void> {
    const result = await this.waitlistRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    const count = result.affected ?? 0;
    if (count > 0) {
      this.logger.log(`Cleaned up ${count} expired waitlist entries`);
    }
  }

  private defaultExpiresAt(): Date {
    const d = new Date();
    d.setDate(d.getDate() + DEFAULT_EXPIRY_DAYS);
    return d;
  }
}
