import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Reminder, ReminderStatus } from './entities/reminder.entity';
import { ReminderService, ReminderNotification } from './reminder.service';
import { Pet } from '../pets/entities/pet.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/entities/notification.entity';

export interface BatchProcessingResult {
  processedCount: number;
  notificationsSent: number;
  errors: string[];
  notifications: ReminderNotification[];
}

@Injectable()
export class BatchProcessingService {
  private readonly logger = new Logger(BatchProcessingService.name);

  constructor(
    @InjectRepository(Reminder)
    private readonly reminderRepository: Repository<Reminder>,
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(UserPreference)
    private readonly preferenceRepository: Repository<UserPreference>,
    private readonly reminderService: ReminderService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Automated cron job to process reminders every hour
   * This allows for timezone-aware notification delivery
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Running automated reminder processing...');
    await this.wakeupSnoozedReminders();
    const result = await this.processAllPendingReminders();

    // Dispatch notifications to the notification system
    for (const notification of result.notifications) {
      try {
        await this.notificationsService.create({
          userId: notification.userId,
          title: notification.title,
          message: notification.message,
          category: this.mapTypeToCategory(notification.type),
          metadata: {
            reminderId: notification.reminderId,
            petId: notification.petId,
            level: notification.level,
            dueDate: notification.dueDate,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to dispatch notification for reminder ${notification.reminderId}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Process all pending reminders in batch
   */
  async processAllPendingReminders(): Promise<BatchProcessingResult> {
    const result: BatchProcessingResult = {
      processedCount: 0,
      notificationsSent: 0,
      errors: [],
      notifications: [],
    };

    try {
      // Process escalation for all active reminders
      // Note: In a real production system, we would filter by timezone here
      const notifications =
        await this.reminderService.processReminderEscalation();
      result.notifications = notifications;
      result.notificationsSent = notifications.length;

      result.processedCount = await this.reminderRepository.count({
        where: {
          status: In([
            ReminderStatus.PENDING,
            ReminderStatus.SENT_7_DAYS,
            ReminderStatus.SENT_3_DAYS,
            ReminderStatus.SENT_1_DAY,
            ReminderStatus.SENT_DAY_OF,
            ReminderStatus.OVERDUE,
          ]),
        },
      });

      this.logger.log(
        `Batch processing complete: ${result.processedCount} reminders processed, ${result.notificationsSent} notifications generated`,
      );
    } catch (error) {
      result.errors.push(`Batch processing failed: ${error.message}`);
      this.logger.error(`Batch processing error: ${error.message}`);
    }

    return result;
  }

  /**
   * Automated cron job to generate reminders for all pets daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyGeneration() {
    this.logger.log('Running daily reminder generation for all pets...');
    await this.generateRemindersForAllPets();
  }

  /**
   * Generate reminders for all pets in batch
   */
  async generateRemindersForAllPets() {
    const pets = await this.petRepository.find({ where: { isActive: true } });
    let count = 0;

    for (const pet of pets) {
      try {
        const reminders =
          await this.reminderService.generateVaccinationReminders(pet.id);
        count += reminders.length;
      } catch (error) {
        this.logger.error(
          `Error generating reminders for pet ${pet.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Batch generation complete: ${count} reminders generated for ${pets.length} pets`,
    );
    return { petsProcessed: pets.length, remindersGenerated: count };
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
      reminder.snoozedUntil = null;
      await this.reminderRepository.save(reminder);
    }

    if (snoozedReminders.length > 0) {
      this.logger.log(`Woke up ${snoozedReminders.length} snoozed reminders`);
    }

    return snoozedReminders.length;
  }

  /**
   * Map reminder type to notification category
   */
  private mapTypeToCategory(type: string): NotificationCategory {
    switch (type) {
      case 'VACCINATION':
        return NotificationCategory.VACCINATION;
      case 'APPOINTMENT':
        return NotificationCategory.APPOINTMENT;
      case 'MEDICATION':
        return NotificationCategory.MEDICATION;
      default:
        return NotificationCategory.SYSTEM;
    }
  }

  /**
   * Get batch processing statistics
   */
  async getStatistics() {
    const stats = await this.reminderRepository
      .createQueryBuilder('reminder')
      .select('reminder.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('reminder.status')
      .getRawMany();

    const result = {
      total: 0,
      PENDING: 0,
      COMPLETED: 0,
      OVERDUE: 0,
      SNOOZED: 0,
      CANCELLED: 0,
    };

    stats.forEach((s) => {
      result[s.status] = parseInt(s.count, 10);
      result.total += parseInt(s.count, 10);
    });

    return result;
  }
}
