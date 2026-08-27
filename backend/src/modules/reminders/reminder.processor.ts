import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '../notifications/notifications.service';
import { ReminderService } from './reminder.service';
import { ReminderStatus } from './entities/reminder.entity';
import { NotificationCategory } from '../notifications/entities/notification.entity';

export interface ReminderJobData {
  reminderId: string;
}

@Processor('reminders')
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    private readonly reminderService: ReminderService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { reminderId } = job.data;
    this.logger.log(`Processing reminder job ${job.id} for reminder ${reminderId}`);

    const reminder = await this.reminderService.findOne(reminderId);

    if (reminder.status !== ReminderStatus.PENDING) {
      this.logger.log(`Reminder ${reminderId} is not PENDING (status: ${reminder.status}), skipping`);
      return;
    }

    try {
      await this.notificationsService.create({
        userId: reminder.userId,
        title: reminder.title,
        message: reminder.description ?? reminder.title,
        category: NotificationCategory.VACCINATION,
        metadata: { reminderId: reminder.id, petId: reminder.petId },
      });

      await this.reminderService.update(reminderId, {
        status: ReminderStatus.SENT_DAY_OF,
      });

      this.logger.log(`Reminder ${reminderId} dispatched successfully`);
    } catch (err: any) {
      this.logger.error(`Failed to dispatch reminder ${reminderId}: ${err?.message}`);

      // Mark FAILED only after all BullMQ retries are exhausted
      if (job.attemptsMade >= (job.opts.attempts ?? 1) - 1) {
        await this.reminderService.update(reminderId, {
          status: ReminderStatus.FAILED,
        });
      }

      throw err; // re-throw so BullMQ applies retry/backoff
    }
  }
}
