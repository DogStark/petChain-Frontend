import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import {
  Reminder,
  ReminderStatus,
  ReminderType,
} from './entities/reminder.entity';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { Pet } from '../pets/entities/pet.entity';
import { VaccinationSchedule } from '../vaccinations/entities/vaccination-schedule.entity';
import { User } from '../users/entities/user.entity';

/**
 * Notification payload for external notification services
 */
export interface ReminderNotification {
  reminderId: string;
  petId: string;
  petName: string;
  userId: string;
  userEmail?: string;
  type: ReminderType;
  title: string;
  dueDate: Date;
  daysUntilDue: number;
  level: 'FIRST' | 'SECOND' | 'THIRD' | 'FINAL' | 'OVERDUE';
  message: string;
}

@Injectable()
export class ReminderService {
  // Default reminder intervals: 7 days, 3 days, 1 day, and day of
  private readonly DEFAULT_INTERVALS = [7, 3, 1, 0];

  constructor(
    @InjectRepository(Reminder)
    private readonly reminderRepository: Repository<Reminder>,
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(VaccinationSchedule)
    private readonly scheduleRepository: Repository<VaccinationSchedule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Create a new reminder
   */
  async create(createReminderDto: any): Promise<Reminder> {
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
  async findAll(): Promise<Reminder[]> {
    return await this.reminderRepository.find({
      relations: ['pet', 'user'],
      order: { dueDate: 'ASC' },
    });
  }

  /**
   * Get reminders by pet
   */
  async findByPet(petId: string): Promise<Reminder[]> {
    return await this.reminderRepository.find({
      where: { petId },
      order: { dueDate: 'ASC' },
    });
  }

  /**
   * Get reminders by user
   */
  async findByUser(userId: string): Promise<Reminder[]> {
    return await this.reminderRepository.find({
      where: { userId },
      relations: ['pet'],
      order: { dueDate: 'ASC' },
    });
  }

  /**
   * Get upcoming reminders
   */
  async findUpcoming(daysAhead: number = 30): Promise<Reminder[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await this.reminderRepository
      .createQueryBuilder('reminder')
      .leftJoinAndSelect('reminder.pet', 'pet')
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
  async findOne(id: string): Promise<Reminder> {
    const reminder = await this.reminderRepository.findOne({
      where: { id },
      relations: ['pet', 'user'],
    });
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    return reminder;
  }

  /**
   * Update a reminder
   */
  async update(id: string, updateReminderDto: any): Promise<Reminder> {
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
  async markComplete(id: string, metadataUpdate?: any): Promise<Reminder> {
    const reminder = await this.findOne(id);
    reminder.status = ReminderStatus.COMPLETED;
    reminder.completedAt = new Date();
    if (metadataUpdate) {
      reminder.metadata = { ...reminder.metadata, ...metadataUpdate };
    }
    return await this.reminderRepository.save(reminder);
  }

  /**
   * Snooze a reminder
   */
  async snooze(id: string, days: number = 1): Promise<Reminder> {
    const reminder = await this.findOne(id);
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);
    reminder.status = ReminderStatus.SNOOZED;
    reminder.snoozedUntil = snoozedUntil;
    return await this.reminderRepository.save(reminder);
  }

  /**
   * Generate vaccination reminders for a pet based on breed schedules
   */
  async generateVaccinationReminders(petId: string): Promise<Reminder[]> {
    const pet = await this.petRepository.findOne({
      where: { id: petId },
      relations: ['breed'],
    });

    if (!pet) throw new NotFoundException(`Pet with ID ${petId} not found`);

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

    const reminders: Reminder[] = [];
    const petAgeWeeks = this.calculateAgeInWeeks(pet.dateOfBirth);

    for (const schedule of schedules) {
      const existingReminder = await this.reminderRepository.findOne({
        where: {
          petId,
          type: ReminderType.VACCINATION,
          status: Not(In([ReminderStatus.COMPLETED, ReminderStatus.CANCELLED])),
        },
      });
      // Simple check for schedule in metadata - could be more robust
      if (
        existingReminder &&
        existingReminder.metadata?.vaccinationScheduleId === schedule.id
      )
        continue;

      const dueDate = this.calculateDueDate(
        pet.dateOfBirth,
        schedule,
        petAgeWeeks,
      );

      if (dueDate) {
        const reminder = this.reminderRepository.create({
          petId,
          userId: pet.ownerId,
          type: ReminderType.VACCINATION,
          title: `${schedule.vaccineName} Vaccination`,
          description: `Upcoming ${schedule.vaccineName} vaccination for ${pet.name}.`,
          dueDate,
          customIntervalDays: this.DEFAULT_INTERVALS,
          metadata: { vaccinationScheduleId: schedule.id },
        });
        reminders.push(await this.reminderRepository.save(reminder));
      }
    }

    return reminders;
  }

  /**
   * Process reminder escalation for all types
   */
  async processReminderEscalation(): Promise<ReminderNotification[]> {
    const now = new Date();
    const notifications: ReminderNotification[] = [];

    const activeStatuses = [
      ReminderStatus.PENDING,
      ReminderStatus.SENT_7_DAYS,
      ReminderStatus.SENT_3_DAYS,
      ReminderStatus.SENT_1_DAY,
    ];

    const reminders = await this.reminderRepository.find({
      where: { status: In(activeStatuses) },
      relations: ['pet', 'user'],
    });

    for (const reminder of reminders) {
      const dueDate = new Date(reminder.dueDate);
      const diffTime = dueDate.getTime() - now.getTime();
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const intervals = reminder.customIntervalDays || this.DEFAULT_INTERVALS;
      let notification: ReminderNotification | null = null;

      if (daysUntilDue < 0) {
        reminder.status = ReminderStatus.OVERDUE;
        notification = this.createNotification(
          reminder,
          daysUntilDue,
          'OVERDUE',
        );
      } else if (
        daysUntilDue <= (intervals[3] ?? 0) &&
        reminder.status !== ReminderStatus.SENT_DAY_OF
      ) {
        reminder.status = ReminderStatus.SENT_DAY_OF;
        notification = this.createNotification(reminder, daysUntilDue, 'FINAL');
      } else if (
        daysUntilDue <= (intervals[2] ?? 1) &&
        reminder.status === ReminderStatus.SENT_3_DAYS
      ) {
        reminder.status = ReminderStatus.SENT_1_DAY;
        notification = this.createNotification(reminder, daysUntilDue, 'THIRD');
      } else if (
        daysUntilDue <= (intervals[1] ?? 3) &&
        reminder.status === ReminderStatus.SENT_7_DAYS
      ) {
        reminder.status = ReminderStatus.SENT_3_DAYS;
        notification = this.createNotification(
          reminder,
          daysUntilDue,
          'SECOND',
        );
      } else if (
        daysUntilDue <= (intervals[0] ?? 7) &&
        reminder.status === ReminderStatus.PENDING
      ) {
        reminder.status = ReminderStatus.SENT_7_DAYS;
        notification = this.createNotification(reminder, daysUntilDue, 'FIRST');
      }

      if (notification) {
        const sentAt = reminder.reminderSentAt || [];
        sentAt.push(now.toISOString());
        reminder.reminderSentAt = sentAt;
        await this.reminderRepository.save(reminder);
        notifications.push(notification);
      }
    }

    return notifications;
  }

  private createNotification(
    reminder: Reminder,
    daysUntilDue: number,
    level: 'FIRST' | 'SECOND' | 'THIRD' | 'FINAL' | 'OVERDUE',
  ): ReminderNotification {
    const messages = {
      FIRST: `Reminder: ${reminder.title} for ${reminder.pet?.name} is due in ${daysUntilDue} days.`,
      SECOND: `Upcoming: ${reminder.title} for ${reminder.pet?.name} is due in ${daysUntilDue} days.`,
      THIRD: `Tomorrow: ${reminder.title} for ${reminder.pet?.name} is due tomorrow!`,
      FINAL: `Today: ${reminder.title} for ${reminder.pet?.name} is due today!`,
      OVERDUE: `Overdue: ${reminder.title} for ${reminder.pet?.name} is ${Math.abs(daysUntilDue)} days overdue!`,
    };

    return {
      reminderId: reminder.id,
      petId: reminder.petId,
      petName: reminder.pet?.name || 'Unknown',
      userId: reminder.userId,
      userEmail: reminder.user?.email,
      type: reminder.type,
      title: reminder.title,
      dueDate: reminder.dueDate,
      daysUntilDue,
      level,
      message: messages[level],
    };
  }

  private calculateAgeInWeeks(dateOfBirth: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(dateOfBirth).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
  }

  private calculateDueDate(
    dateOfBirth: Date,
    schedule: VaccinationSchedule,
    currentAgeWeeks: number,
  ): Date | null {
    const birthDate = new Date(dateOfBirth);
    if (currentAgeWeeks < schedule.recommendedAgeWeeks) {
      const dueDate = new Date(birthDate);
      dueDate.setDate(dueDate.getDate() + schedule.recommendedAgeWeeks * 7);
      return dueDate;
    }
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
    return null;
  }
}
