import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Reminder, ReminderStatus } from './entities/reminder.entity';
import { ReminderJobData } from './reminder.processor';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    @InjectQueue('reminders') private readonly remindersQueue: Queue,
    @InjectRepository(Reminder)
    private readonly reminderRepository: Repository<Reminder>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleUpcomingReminders(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const reminders = await this.reminderRepository.find({
      where: {
        status: ReminderStatus.PENDING,
        dueDate: Between(now, in24h),
      },
    });

    this.logger.log(`Found ${reminders.length} reminders due within 24 hours`);

    for (const reminder of reminders) {
      const jobId = `reminder:${reminder.id}`;
      const delay = Math.max(0, reminder.dueDate.getTime() - Date.now());

      // Check if job already exists to avoid double-enqueuing
      const existing = await this.remindersQueue.getJob(jobId);
      if (existing) {
        this.logger.debug(`Reminder ${reminder.id} already enqueued, skipping`);
        continue;
      }

      await this.remindersQueue.add(
        'dispatch',
        { reminderId: reminder.id } satisfies ReminderJobData,
        {
          jobId,
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(`Enqueued reminder ${reminder.id} with delay ${delay}ms`);
    }
  }
}
