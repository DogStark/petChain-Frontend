import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vaccination } from './entities/vaccination.entity';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { v4 as uuidv4 } from 'uuid';
import { Pet } from '../pets/entities/pet.entity';
import { VaccinationSchedule } from './entities/vaccination-schedule.entity';
import {
  Reminder,
  ReminderStatus,
  ReminderType,
} from '../reminders/entities/reminder.entity';
import { ReminderService } from '../reminders/reminder.service';
import { VaccinationAdverseReaction } from './entities/vaccination-adverse-reaction.entity';
import { CreateAdverseReactionDto } from './dto/create-adverse-reaction.dto';

@Injectable()
export class VaccinationsService {
  constructor(
    @InjectRepository(Vaccination)
    private readonly vaccinationRepository: Repository<Vaccination>,
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(VaccinationSchedule)
    private readonly vaccinationScheduleRepository: Repository<VaccinationSchedule>,
    @InjectRepository(VaccinationAdverseReaction)
    private readonly adverseReactionRepository: Repository<VaccinationAdverseReaction>,
    @InjectRepository(Reminder)
    private readonly reminderRepository: Repository<Reminder>,
    private readonly reminderService: ReminderService,
  ) {}

  /**
   * Create a new vaccination record
   */
  async create(
    createVaccinationDto: CreateVaccinationDto,
  ): Promise<Vaccination> {
    const pet = await this.petRepository.findOne({
      where: { id: createVaccinationDto.petId },
    });
    if (!pet) {
      throw new NotFoundException(
        `Pet with ID ${createVaccinationDto.petId} not found`,
      );
    }

    const calculatedNextDueDate =
      createVaccinationDto.nextDueDate ??
      (await this.calculateNextDueDate(
        pet.breedId,
        createVaccinationDto.vaccineName,
        createVaccinationDto.administeredDate,
        createVaccinationDto.expirationDate,
      ));

    const vaccination = this.vaccinationRepository.create({
      ...createVaccinationDto,
      nextDueDate: calculatedNextDueDate || undefined,
      certificateCode: this.generateCertificateCode(),
    });
    const saved = await this.vaccinationRepository.save(vaccination);

    if (createVaccinationDto.adverseReactions?.length) {
      await this.addAdverseReactions(saved.id, createVaccinationDto.adverseReactions);
    }

    await this.ensureReminder(saved, pet);
    return await this.findOne(saved.id);
  }

  /**
   * Get all vaccinations
   */
  async findAll(): Promise<Vaccination[]> {
    return await this.vaccinationRepository.find({
      relations: ['pet', 'vet', 'vetClinic', 'adverseReactions'],
      order: { administeredDate: 'DESC' },
    });
  }

  /**
   * Get vaccinations by pet ID
   */
  async findByPet(petId: string): Promise<Vaccination[]> {
    return await this.vaccinationRepository.find({
      where: { petId },
      relations: ['vet', 'vetClinic', 'adverseReactions'],
      order: { administeredDate: 'DESC' },
    });
  }

  /**
   * Get a single vaccination by ID
   */
  async findOne(id: string): Promise<Vaccination> {
    const vaccination = await this.vaccinationRepository.findOne({
      where: { id },
      relations: ['pet', 'vet', 'vetClinic', 'adverseReactions'],
    });
    if (!vaccination) {
      throw new NotFoundException(`Vaccination with ID ${id} not found`);
    }
    return vaccination;
  }

  /**
   * Find vaccination by certificate code
   */
  async findByCertificateCode(code: string): Promise<Vaccination> {
    const vaccination = await this.vaccinationRepository.findOne({
      where: { certificateCode: code },
      relations: ['pet', 'vet', 'vetClinic', 'adverseReactions'],
    });
    if (!vaccination) {
      throw new NotFoundException(
        `Vaccination with certificate code ${code} not found`,
      );
    }
    return vaccination;
  }

  /**
   * Update a vaccination
   */
  async update(
    id: string,
    updateVaccinationDto: UpdateVaccinationDto,
  ): Promise<Vaccination> {
    const vaccination = await this.findOne(id);
    Object.assign(vaccination, updateVaccinationDto);
    if (
      updateVaccinationDto.nextDueDate === undefined &&
      (updateVaccinationDto.vaccineName || updateVaccinationDto.administeredDate)
    ) {
      const pet = await this.petRepository.findOne({
        where: { id: vaccination.petId },
      });
      if (pet) {
        vaccination.nextDueDate = await this.calculateNextDueDate(
          pet.breedId,
          vaccination.vaccineName,
          vaccination.administeredDate,
          vaccination.expirationDate,
        );
      }
    }

    const saved = await this.vaccinationRepository.save(vaccination);
    const pet = await this.petRepository.findOne({
      where: { id: saved.petId },
    });
    if (pet) {
      await this.ensureReminder(saved, pet);
    }
    return await this.findOne(saved.id);
  }

  /**
   * Delete a vaccination
   */
  async remove(id: string): Promise<void> {
    const vaccination = await this.findOne(id);
    await this.vaccinationRepository.remove(vaccination);
  }

  /**
   * Get upcoming due vaccinations for reminders
   */
  async getUpcomingDueVaccinations(daysAhead = 30): Promise<Vaccination[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);

    return await this.vaccinationRepository
      .createQueryBuilder('vaccination')
      .leftJoinAndSelect('vaccination.pet', 'pet')
      .leftJoinAndSelect('vaccination.vet', 'vet')
      .leftJoinAndSelect('vaccination.adverseReactions', 'adverseReactions')
      .where('vaccination.next_due_date IS NOT NULL')
      .andWhere('vaccination.next_due_date BETWEEN :now AND :targetDate', {
        now: new Date(),
        targetDate,
      })
      .orderBy('vaccination.next_due_date', 'ASC')
      .getMany();
  }

  /**
   * Add adverse reaction logs for a vaccination
   */
  async addAdverseReactions(
    vaccinationId: string,
    reactions: CreateAdverseReactionDto[],
  ): Promise<VaccinationAdverseReaction[]> {
    await this.findOne(vaccinationId);
    if (!reactions.length) {
      return [];
    }
    const entities = reactions.map((reaction) =>
      this.adverseReactionRepository.create({
        vaccinationId,
        reaction: reaction.reaction,
        severity: reaction.severity || null,
        onsetAt: reaction.onsetAt || null,
        notes: reaction.notes || null,
      }),
    );
    return await this.adverseReactionRepository.save(entities);
  }

  /**
   * Get vaccination statistics for a pet
   */
  async getVaccinationStats(petId: string): Promise<{
    total: number;
    upToDate: number;
    overdue: number;
    upcoming: number;
  }> {
    const vaccinations = await this.findByPet(petId);
    const now = new Date();

    let upToDate = 0;
    let overdue = 0;
    let upcoming = 0;

    vaccinations.forEach((v) => {
      if (v.nextDueDate) {
        const dueDate = new Date(v.nextDueDate);
        if (dueDate < now) {
          overdue++;
        } else {
          const daysUntilDue = Math.floor(
            (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysUntilDue <= 30) {
            upcoming++;
          } else {
            upToDate++;
          }
        }
      } else {
        upToDate++;
      }
    });

    return {
      total: vaccinations.length,
      upToDate,
      overdue,
      upcoming,
    };
  }

  private async ensureReminder(vaccination: Vaccination, pet: Pet): Promise<void> {
    if (!vaccination.nextDueDate) {
      return;
    }

    const existing = await this.reminderRepository
      .createQueryBuilder('reminder')
      .where('reminder.type = :type', { type: ReminderType.VACCINATION })
      .andWhere('reminder.petId = :petId', { petId: vaccination.petId })
      .andWhere(
        'reminder.status NOT IN (:...excludedStatuses)',
        {
          excludedStatuses: [
            ReminderStatus.COMPLETED,
            ReminderStatus.CANCELLED,
          ],
        },
      )
      .andWhere(`reminder.metadata ->> 'vaccinationId' = :vaccinationId`, {
        vaccinationId: vaccination.id,
      })
      .getOne();

    if (existing) {
      existing.dueDate = vaccination.nextDueDate;
      existing.title = `${vaccination.vaccineName} Booster`;
      existing.description = `${pet.name} is due for ${vaccination.vaccineName}.`;
      await this.reminderRepository.save(existing);
      return;
    }

    await this.reminderService.create({
      petId: vaccination.petId,
      userId: pet.ownerId,
      type: ReminderType.VACCINATION,
      title: `${vaccination.vaccineName} Booster`,
      description: `${pet.name} is due for ${vaccination.vaccineName}.`,
      dueDate: vaccination.nextDueDate,
      metadata: {
        vaccinationId: vaccination.id,
        vaccineName: vaccination.vaccineName,
      },
    });
  }

  private async calculateNextDueDate(
    breedId: string | null,
    vaccineName: string,
    administeredDate: Date,
    expirationDate?: Date,
  ): Promise<Date | null> {
    const schedule = await this.vaccinationScheduleRepository
      .createQueryBuilder('schedule')
      .where('LOWER(schedule.vaccineName) = LOWER(:vaccineName)', {
        vaccineName,
      })
      .andWhere('schedule.isActive = :isActive', { isActive: true })
      .andWhere(
        breedId
          ? '(schedule.breedId = :breedId OR schedule.breedId IS NULL)'
          : 'schedule.breedId IS NULL',
        breedId ? { breedId } : {},
      )
      .orderBy('schedule.breedId', 'DESC')
      .getOne();

    if (schedule?.intervalWeeks) {
      const nextDue = new Date(administeredDate);
      nextDue.setDate(nextDue.getDate() + schedule.intervalWeeks * 7);
      return nextDue;
    }

    return expirationDate || null;
  }

  /**
   * Generate a unique certificate code
   */
  private generateCertificateCode(): string {
    const uuid = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
    return `VAX-${uuid}`;
  }
}
