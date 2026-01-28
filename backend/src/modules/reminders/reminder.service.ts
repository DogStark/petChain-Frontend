import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import {
  VaccinationReminder,
  ReminderStatus,
} from './entities/vaccination-reminder.entity';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { Pet } from '../pets/entities/pet.entity';
import { VaccinationSchedule } from '../vaccinations/entities/vaccination-schedule.entity';

/**
 * Notification payload for external notification services
 */
export interface ReminderNotification {
  reminderId: string;
  petId: string;
  petName: string;
  ownerId: string;
  ownerEmail?: string;
  vaccineName: string;
  dueDate: Date;
  daysUntilDue: number;
  escalationLevel: 'FIRST' | 'SECOND' | 'FINAL' | 'OVERDUE';
  message: string;
}

@Injectable()
export class ReminderService {
  // Default reminder intervals: 7 days, 3 days, and day of
  private readonly DEFAULT_INTERVALS = [7, 3, 0];

  constructor(
    @InjectRepository(VaccinationReminder)
    private readonly reminderRepository: Repository<VaccinationReminder>,
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(VaccinationSchedule)
    private readonly scheduleRepository: Repository<VaccinationSchedule>,
  ) {}

  /**
   * Create a new reminder
   */
  async create(
    createReminderDto: CreateReminderDto,
  ): Promise<VaccinationReminder> {
    const reminder = this.reminderRepository.create({
      ...createReminderDto,
      customIntervalDays:
        createReminderDto.customIntervalDays || this.DEFAULT_INTERVALS,
    });
    return await this.reminderRepository.save(reminder);
  }

  /**
   * Get all reminders
   */
  async findAll(): Promise<VaccinationReminder[]> {
    return await this.reminderRepository.find({
      relations: ['pet', 'vaccinationSchedule'],
      order: { dueDate: 'ASC' },
    });
  }

  /**
   * Get reminders by pet
   */
  async findByPet(petId: string): Promise<VaccinationReminder[]> {
    return await this.reminderRepository.find({
      where: { petId },
      relations: ['vaccinationSchedule'],
      order: { dueDate: 'ASC' },
    });
  }

  /**
   * Get reminders by owner (through pets)
   */
  async findByOwner(ownerId: string): Promise<VaccinationReminder[]> {
    const pets = await this.petRepository.find({ where: { ownerId } });
    const petIds = pets.map((p) => p.id);

    if (petIds.length === 0) return [];

    return await this.reminderRepository.find({
      where: { petId: In(petIds) },
      relations: ['pet', 'vaccinationSchedule'],
      order: { dueDate: 'ASC' },
    });
  }

  /**
   * Get upcoming reminders (pending and not overdue)
   */
  async findUpcoming(daysAhead: number = 30): Promise<VaccinationReminder[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await this.reminderRepository
      .createQueryBuilder('reminder')
      .leftJoinAndSelect('reminder.pet', 'pet')
      .leftJoinAndSelect('reminder.vaccinationSchedule', 'schedule')
      .where('reminder.dueDate <= :futureDate', { futureDate })
      .andWhere('reminder.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [ReminderStatus.COMPLETED, ReminderStatus.CANCELLED],
      })
      .orderBy('reminder.dueDate', 'ASC')
      .getMany();
  }

  /**
   * Get a single reminder
   */
  async findOne(id: string): Promise<VaccinationReminder> {
    const reminder = await this.reminderRepository.findOne({
      where: { id },
      relations: ['pet', 'vaccinationSchedule'],
    });
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    return reminder;
  }

  /**
   * Update a reminder
   */
  async update(
    id: string,
    updateReminderDto: UpdateReminderDto,
  ): Promise<VaccinationReminder> {
    const reminder = await this.findOne(id);
    Object.assign(reminder, updateReminderDto);
    return await this.reminderRepository.save(reminder);
  }

  /**
   * Delete a reminder
   */
  async remove(id: string): Promise<void> {
    const reminder = await this.findOne(id);
    await this.reminderRepository.remove(reminder);
  }

  /**
   * Mark reminder as complete
   */
  async markComplete(
    id: string,
    vaccinationId?: string,
  ): Promise<VaccinationReminder> {
    const reminder = await this.findOne(id);
    reminder.status = ReminderStatus.COMPLETED;
    reminder.completedAt = new Date();
    if (vaccinationId) {
      reminder.vaccinationId = vaccinationId;
    }
    return await this.reminderRepository.save(reminder);
  }

  /**
   * Snooze a reminder
   */
  async snooze(id: string, days: number = 1): Promise<VaccinationReminder> {
    const reminder = await this.findOne(id);
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);
    reminder.status = ReminderStatus.SNOOZED;
    reminder.snoozedUntil = snoozedUntil;
    return await this.reminderRepository.save(reminder);
  }

  /**
   * Set custom reminder intervals
   */
  async setCustomIntervals(
    id: string,
    intervals: number[],
  ): Promise<VaccinationReminder> {
    const reminder = await this.findOne(id);
    // Sort intervals in descending order (largest first)
    reminder.customIntervalDays = [...intervals].sort((a, b) => b - a);
    return await this.reminderRepository.save(reminder);
  }

  /**
   * Generate reminders for a pet based on breed schedules
   */
  async generateRemindersForPet(petId: string): Promise<VaccinationReminder[]> {
    const pet = await this.petRepository.findOne({
      where: { id: petId },
      relations: ['breed'],
    });

    if (!pet) {
      throw new NotFoundException(`Pet with ID ${petId} not found`);
    }

    // Get applicable vaccination schedules
    let schedules: VaccinationSchedule[];
    if (pet.breedId) {
      schedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.breedId = :breedId OR schedule.breedId IS NULL', {
          breedId: pet.breedId,
        })
        .andWhere('schedule.isActive = :isActive', { isActive: true })
        .getMany();
    } else {
      schedules = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.breedId IS NULL')
        .andWhere('schedule.isActive = :isActive', { isActive: true })
        .getMany();
    }

    const reminders: VaccinationReminder[] = [];
    const petAgeWeeks = this.calculateAgeInWeeks(pet.dateOfBirth);

    for (const schedule of schedules) {
      // Check if reminder already exists for this pet and schedule
      const existingReminder = await this.reminderRepository.findOne({
        where: {
          petId,
          vaccinationScheduleId: schedule.id,
          status: Not(In([ReminderStatus.COMPLETED, ReminderStatus.CANCELLED])),
        },
      });

      if (existingReminder) continue;

      // Calculate due date based on pet's age and schedule
      const dueDate = this.calculateDueDate(
        pet.dateOfBirth,
        schedule,
        petAgeWeeks,
      );

      if (dueDate) {
        const reminder = this.reminderRepository.create({
          petId,
          vaccinationScheduleId: schedule.id,
          vaccineName: schedule.vaccineName,
          dueDate,
          customIntervalDays: this.DEFAULT_INTERVALS,
        });
        reminders.push(await this.reminderRepository.save(reminder));
      }
    }

    return reminders;
  }

  /**
   * Process reminder escalation (7 days, 3 days, day of)
   * Returns notifications to be sent
   */
  async processReminderEscalation(): Promise<ReminderNotification[]> {
    const now = new Date();
    const notifications: ReminderNotification[] = [];

    // Get all active reminders
    const reminders = await this.reminderRepository.find({
      where: {
        status: In([
          ReminderStatus.PENDING,
          ReminderStatus.SENT_7_DAYS,
          ReminderStatus.SENT_3_DAYS,
        ]),
      },
      relations: ['pet', 'pet.owner'],
    });

    for (const reminder of reminders) {
      const dueDate = new Date(reminder.dueDate);
      const daysUntilDue = Math.floor(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const intervals = reminder.customIntervalDays || this.DEFAULT_INTERVALS;
      let notification: ReminderNotification | null = null;

      // Check for overdue
      if (daysUntilDue < 0) {
        reminder.status = ReminderStatus.OVERDUE;
        notification = this.createNotification(
          reminder,
          daysUntilDue,
          'OVERDUE',
        );
      }
      // Check for day of (0 days)
      else if (
        daysUntilDue <= (intervals[2] ?? 0) &&
        reminder.status !== ReminderStatus.SENT_DAY_OF
      ) {
        reminder.status = ReminderStatus.SENT_DAY_OF;
        notification = this.createNotification(reminder, daysUntilDue, 'FINAL');
      }
      // Check for 3 days
      else if (
        daysUntilDue <= (intervals[1] ?? 3) &&
        reminder.status === ReminderStatus.SENT_7_DAYS
      ) {
        reminder.status = ReminderStatus.SENT_3_DAYS;
        notification = this.createNotification(
          reminder,
          daysUntilDue,
          'SECOND',
        );
      }
      // Check for 7 days
      else if (
        daysUntilDue <= (intervals[0] ?? 7) &&
        reminder.status === ReminderStatus.PENDING
      ) {
        reminder.status = ReminderStatus.SENT_7_DAYS;
        notification = this.createNotification(reminder, daysUntilDue, 'FIRST');
      }

      if (notification) {
        // Record when reminder was sent
        const sentAt = reminder.reminderSentAt || [];
        sentAt.push(now.toISOString());
        reminder.reminderSentAt = sentAt;

        await this.reminderRepository.save(reminder);
        notifications.push(notification);
      }
    }

    return notifications;
  }

  /**
   * Create notification payload
   */
  private createNotification(
    reminder: VaccinationReminder,
    daysUntilDue: number,
    level: 'FIRST' | 'SECOND' | 'FINAL' | 'OVERDUE',
  ): ReminderNotification {
    const messages = {
      FIRST: `Reminder: ${reminder.pet?.name}'s ${reminder.vaccineName} vaccination is due in ${daysUntilDue} days.`,
      SECOND: `Upcoming: ${reminder.pet?.name}'s ${reminder.vaccineName} vaccination is due in ${daysUntilDue} days. Please schedule an appointment.`,
      FINAL: `Today: ${reminder.pet?.name}'s ${reminder.vaccineName} vaccination is due today!`,
      OVERDUE: `Overdue: ${reminder.pet?.name}'s ${reminder.vaccineName} vaccination is ${Math.abs(daysUntilDue)} days overdue. Please vaccinate immediately.`,
    };

    return {
      reminderId: reminder.id,
      petId: reminder.petId,
      petName: reminder.pet?.name || 'Unknown',
      ownerId: reminder.pet?.ownerId || '',
      ownerEmail: reminder.pet?.owner?.email,
      vaccineName: reminder.vaccineName,
      dueDate: reminder.dueDate,
      daysUntilDue,
      escalationLevel: level,
      message: messages[level],
    };
  }

  /**
   * Calculate age in weeks
   */
  private calculateAgeInWeeks(dateOfBirth: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(dateOfBirth).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
  }

  /**
   * Calculate due date for vaccination
   */
  private calculateDueDate(
    dateOfBirth: Date,
    schedule: VaccinationSchedule,
    currentAgeWeeks: number,
  ): Date | null {
    const birthDate = new Date(dateOfBirth);

    // If pet is younger than recommended age, set due date at recommended age
    if (currentAgeWeeks < schedule.recommendedAgeWeeks) {
      const dueDate = new Date(birthDate);
      dueDate.setDate(dueDate.getDate() + schedule.recommendedAgeWeeks * 7);
      return dueDate;
    }

    // If pet is older and schedule has interval, calculate next due date
    if (schedule.intervalWeeks) {
      const weeksSinceRecommended =
        currentAgeWeeks - schedule.recommendedAgeWeeks;
      const intervalsPassed = Math.floor(
        weeksSinceRecommended / schedule.intervalWeeks,
      );
      const nextIntervalWeeks =
        schedule.recommendedAgeWeeks +
        (intervalsPassed + 1) * schedule.intervalWeeks;

      const dueDate = new Date(birthDate);
      dueDate.setDate(dueDate.getDate() + nextIntervalWeeks * 7);
      return dueDate;
    }

    // One-time vaccine already past due
    return null;
  }
}
