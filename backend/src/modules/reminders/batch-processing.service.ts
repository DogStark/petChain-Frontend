import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import {
  VaccinationReminder,
  ReminderStatus,
} from './entities/vaccination-reminder.entity';
import { ReminderService, ReminderNotification } from './reminder.service';
import { Pet } from '../pets/entities/pet.entity';

export interface BatchProcessingResult {
  processedCount: number;
  notificationsSent: number;
  errors: string[];
  notifications: ReminderNotification[];
}

export interface BatchGenerationResult {
  petsProcessed: number;
  remindersGenerated: number;
  errors: string[];
}

@Injectable()
export class BatchProcessingService {
  private readonly logger = new Logger(BatchProcessingService.name);

  constructor(
    @InjectRepository(VaccinationReminder)
    private readonly reminderRepository: Repository<VaccinationReminder>,
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    private readonly reminderService: ReminderService,
  ) {}

  /**
   * Process all pending reminders in batch
   * Returns notifications that should be sent
   */
  async processAllPendingReminders(): Promise<BatchProcessingResult> {
    const result: BatchProcessingResult = {
      processedCount: 0,
      notificationsSent: 0,
      errors: [],
      notifications: [],
    };

    try {
      // First, wake up snoozed reminders that are past their snooze date
      await this.wakeupSnoozedReminders();

      // Process escalation for all active reminders
      const notifications =
        await this.reminderService.processReminderEscalation();
      result.notifications = notifications;
      result.notificationsSent = notifications.length;

      // Count processed reminders
      result.processedCount = await this.reminderRepository.count({
        where: {
          status: In([
            ReminderStatus.PENDING,
            ReminderStatus.SENT_7_DAYS,
            ReminderStatus.SENT_3_DAYS,
            ReminderStatus.SENT_DAY_OF,
            ReminderStatus.OVERDUE,
          ]),
        },
      });

      this.logger.log(
        `Batch processing complete: ${result.processedCount} reminders processed, ${result.notificationsSent} notifications generated`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Batch processing failed: ${errorMessage}`);
      this.logger.error(`Batch processing error: ${errorMessage}`);
    }

    return result;
  }

  /**
   * Generate reminders for all pets in batch
   */
  async generateRemindersForAllPets(): Promise<BatchGenerationResult> {
    const result: BatchGenerationResult = {
      petsProcessed: 0,
      remindersGenerated: 0,
      errors: [],
    };

    const pets = await this.petRepository.find({ where: { isActive: true } });
    result.petsProcessed = pets.length;

    for (const pet of pets) {
      try {
        const reminders = await this.reminderService.generateRemindersForPet(
          pet.id,
        );
        result.remindersGenerated += reminders.length;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(
          `Failed to generate reminders for pet ${pet.id}: ${errorMessage}`,
        );
        this.logger.error(
          `Error generating reminders for pet ${pet.id}: ${errorMessage}`,
        );
      }
    }

    this.logger.log(
      `Batch generation complete: ${result.petsProcessed} pets processed, ${result.remindersGenerated} reminders generated`,
    );

    return result;
  }

  /**
   * Wake up snoozed reminders that are past their snooze date
   */
  async wakeupSnoozedReminders(): Promise<number> {
    const now = new Date();

    const snoozedReminders = await this.reminderRepository.find({
      where: {
        status: ReminderStatus.SNOOZED,
        snoozedUntil: LessThan(now),
      },
    });

    for (const reminder of snoozedReminders) {
      reminder.status = ReminderStatus.PENDING;
      reminder.snoozedUntil = undefined as unknown as Date;
      await this.reminderRepository.save(reminder);
    }

    if (snoozedReminders.length > 0) {
      this.logger.log(`Woke up ${snoozedReminders.length} snoozed reminders`);
    }

    return snoozedReminders.length;
  }

  /**
   * Cleanup old completed/cancelled reminders
   */
  async cleanupExpiredReminders(olderThanDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const oldReminders = await this.reminderRepository.find({
      where: {
        status: In([ReminderStatus.COMPLETED, ReminderStatus.CANCELLED]),
        updatedAt: LessThan(cutoffDate),
      },
    });

    if (oldReminders.length > 0) {
      await this.reminderRepository.remove(oldReminders);
      this.logger.log(`Cleaned up ${oldReminders.length} old reminders`);
    }

    return oldReminders.length;
  }

  /**
   * Get batch processing statistics
   */
  async getStatistics(): Promise<{
    pending: number;
    sent7Days: number;
    sent3Days: number;
    sentDayOf: number;
    completed: number;
    overdue: number;
    snoozed: number;
    cancelled: number;
    total: number;
  }> {
    const [
      pending,
      sent7Days,
      sent3Days,
      sentDayOf,
      completed,
      overdue,
      snoozed,
      cancelled,
    ] = await Promise.all([
      this.reminderRepository.count({
        where: { status: ReminderStatus.PENDING },
      }),
      this.reminderRepository.count({
        where: { status: ReminderStatus.SENT_7_DAYS },
      }),
      this.reminderRepository.count({
        where: { status: ReminderStatus.SENT_3_DAYS },
      }),
      this.reminderRepository.count({
        where: { status: ReminderStatus.SENT_DAY_OF },
      }),
      this.reminderRepository.count({
        where: { status: ReminderStatus.COMPLETED },
      }),
      this.reminderRepository.count({
        where: { status: ReminderStatus.OVERDUE },
      }),
      this.reminderRepository.count({
        where: { status: ReminderStatus.SNOOZED },
      }),
      this.reminderRepository.count({
        where: { status: ReminderStatus.CANCELLED },
      }),
    ]);

    return {
      pending,
      sent7Days,
      sent3Days,
      sentDayOf,
      completed,
      overdue,
      snoozed,
      cancelled,
      total:
        pending +
        sent7Days +
        sent3Days +
        sentDayOf +
        completed +
        overdue +
        snoozed +
        cancelled,
    };
  }
}
