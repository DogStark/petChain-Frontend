import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrescriptionsService } from './prescriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/entities/notification.entity';

@Injectable()
export class PrescriptionReminderScheduler {
  private readonly logger = new Logger(PrescriptionReminderScheduler.name);

  constructor(
    private readonly prescriptionsService: PrescriptionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 9 * * *') // Daily at 9am
  async sendRefillReminders() {
    this.logger.log('Running prescription refill reminder check...');

    try {
      const reminders = await this.prescriptionsService.getRefillReminders(3);
      let sentCount = 0;

      for (const reminder of reminders) {
        const redisKey = `refill_reminder:${reminder.prescriptionId}:${new Date().toDateString()}`;
        
        // Check if reminder already sent today
        const alreadySent = await this.redis.get(redisKey);
        if (alreadySent) {
          continue;
        }

        // Send notification
        await this.notificationsService.create({
          userId: reminder.petId, // Assuming petId maps to owner
          title: `Refill Reminder: ${reminder.medication}`,
          message: `${reminder.petName}'s ${reminder.medication} needs a refill in ${reminder.daysUntilRefill} days (est. ${reminder.estimatedRefillDate.toDateString()})`,
          category: NotificationCategory.MEDICATION,
          metadata: {
            prescriptionId: reminder.prescriptionId,
            petId: reminder.petId,
            medication: reminder.medication,
            daysUntilRefill: reminder.daysUntilRefill,
            estimatedRefillDate: reminder.estimatedRefillDate,
          },
        });

        // Mark as sent with 24h TTL
        await this.redis.setex(redisKey, 86400, 'sent');
        sentCount++;
      }

      this.logger.log(`Sent ${sentCount} refill reminders out of ${reminders.length} due`);
    } catch (error) {
      this.logger.error('Failed to send refill reminders:', error);
    }
  }
}