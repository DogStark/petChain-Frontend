import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Vaccination } from './entities/vaccination.entity';
import { VaccinationReaction } from './entities/vaccination-reaction.entity';
import { VaccinationSchedule } from './entities/vaccination-schedule.entity';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { CreateVaccinationReactionDto } from './dto/create-vaccination-reaction.dto';
import { UpdateVaccinationReactionDto } from './dto/update-vaccination-reaction.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VaccinationsService {
  constructor(
    @InjectRepository(Vaccination)
    private readonly vaccinationRepository: Repository<Vaccination>,
    @InjectRepository(VaccinationReaction)
    private readonly reactionRepository: Repository<VaccinationReaction>,
    @InjectRepository(VaccinationSchedule)
    private readonly scheduleRepository: Repository<VaccinationSchedule>,
  ) {}

  /**
   * Create a new vaccination record
   */
  async create(createVaccinationDto: CreateVaccinationDto): Promise<Vaccination> {
    const vaccination = this.vaccinationRepository.create({
      ...createVaccinationDto,
      certificateCode: this.generateCertificateCode(),
      dateAdministered: new Date(createVaccinationDto.dateAdministered),
      nextDueDate: createVaccinationDto.nextDueDate
        ? new Date(createVaccinationDto.nextDueDate)
        : null,
      expirationDate: createVaccinationDto.expirationDate
        ? new Date(createVaccinationDto.expirationDate)
        : null,
    });

    return await this.vaccinationRepository.save(vaccination);
  }

  /**
   * Get all vaccinations
   */
  async findAll(): Promise<Vaccination[]> {
    return await this.vaccinationRepository.find({
      relations: ['pet', 'vetClinic', 'reactions'],
      order: { dateAdministered: 'DESC' },
    });
  }

  /**
   * Get vaccinations by pet ID
   */
  async findByPet(petId: string): Promise<Vaccination[]> {
    return await this.vaccinationRepository.find({
      where: { petId },
      relations: ['vetClinic', 'reactions'],
      order: { dateAdministered: 'DESC' },
    });
  }

  /**
   * Get a single vaccination by ID
   */
  async findOne(id: string): Promise<Vaccination> {
    const vaccination = await this.vaccinationRepository.findOne({
      where: { id },
      relations: ['pet', 'vetClinic', 'reactions'],
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
      relations: ['pet', 'vetClinic', 'reactions'],
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

    const updateData = { ...updateVaccinationDto };
    if (updateData.dateAdministered) {
      updateData['dateAdministered'] = new Date(updateData.dateAdministered as any);
    }
    if (updateData.nextDueDate) {
      updateData['nextDueDate'] = new Date(updateData.nextDueDate as any);
    }
    if (updateData.expirationDate) {
      updateData['expirationDate'] = new Date(updateData.expirationDate as any);
    }

    Object.assign(vaccination, updateData);
    return await this.vaccinationRepository.save(vaccination);
  }

  /**
   * Delete a vaccination
   */
  async remove(id: string): Promise<void> {
    const vaccination = await this.findOne(id);
    await this.vaccinationRepository.remove(vaccination);
  }

  /**
   * Get upcoming vaccination reminders (due within specified days)
   */
  async getUpcomingReminders(days: number = 30): Promise<Vaccination[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + days);

    return await this.vaccinationRepository.find({
      where: {
        nextDueDate: MoreThanOrEqual(today) && LessThanOrEqual(futureDate),
      },
      relations: ['pet', 'vetClinic'],
      order: { nextDueDate: 'ASC' },
    });
  }

  /**
   * Get overdue vaccinations
   */
  async getOverdueVaccinations(petId?: string): Promise<Vaccination[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      nextDueDate: LessThanOrEqual(today),
    };

    if (petId) {
      where.petId = petId;
    }

    return await this.vaccinationRepository.find({
      where,
      relations: ['pet', 'vetClinic'],
      order: { nextDueDate: 'ASC' },
    });
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

  /**
   * Calculate next due date based on vaccination schedule
   */
  async calculateNextDueDate(
    petId: string,
    vaccineName: string,
    dateAdministered: Date,
  ): Promise<Date | null> {
    // Get pet breed to find vaccination schedule
    // This assumes pet has a breed relationship
    const schedule = await this.scheduleRepository.findOne({
      where: { vaccineName },
    });

    if (!schedule || !schedule.intervalWeeks) {
      return null;
    }

    const nextDueDate = new Date(dateAdministered);
    nextDueDate.setDate(
      nextDueDate.getDate() + schedule.intervalWeeks * 7,
    );

    return nextDueDate;
  }

  /**
   * Add an adverse reaction to a vaccination
   */
  async addReaction(
    vaccinationId: string,
    createReactionDto: CreateVaccinationReactionDto,
  ): Promise<VaccinationReaction> {
    const vaccination = await this.findOne(vaccinationId);

    const reaction = this.reactionRepository.create({
      ...createReactionDto,
      vaccinationId,
    });

    return await this.reactionRepository.save(reaction);
  }

  /**
   * Get reactions for a vaccination
   */
  async getReactions(vaccinationId: string): Promise<VaccinationReaction[]> {
    return await this.reactionRepository.find({
      where: { vaccinationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update a reaction
   */
  async updateReaction(
    reactionId: string,
    updateReactionDto: UpdateVaccinationReactionDto,
  ): Promise<VaccinationReaction> {
    const reaction = await this.reactionRepository.findOne({
      where: { id: reactionId },
    });

    if (!reaction) {
      throw new NotFoundException(`Reaction with ID ${reactionId} not found`);
    }

    Object.assign(reaction, updateReactionDto);
    return await this.reactionRepository.save(reaction);
  }

  /**
   * Delete a reaction
   */
  async removeReaction(reactionId: string): Promise<void> {
    const reaction = await this.reactionRepository.findOne({
      where: { id: reactionId },
    });

    if (!reaction) {
      throw new NotFoundException(`Reaction with ID ${reactionId} not found`);
    }

    await this.reactionRepository.remove(reaction);
  }

  /**
   * Generate a unique certificate code
   */
  private generateCertificateCode(): string {
    const uuid = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
    return `VAX-${uuid}`;
  }

  /**
   * Mark reminder as sent
   */
  async markReminderSent(vaccinationId: string): Promise<Vaccination> {
    const vaccination = await this.findOne(vaccinationId);
    vaccination.reminderSent = true;
    return await this.vaccinationRepository.save(vaccination);
  }
}
