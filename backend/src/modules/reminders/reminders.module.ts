import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Reminder } from './entities/reminder.entity';
import { Pet } from '../pets/entities/pet.entity';
import { VaccinationSchedule } from '../vaccinations/entities/vaccination-schedule.entity';
import { User } from '../users/entities/user.entity';
import { ReminderService } from './reminder.service';
import { BatchProcessingService } from './batch-processing.service';
import { RemindersController } from './reminders.controller';
import { ReminderProcessor } from './reminder.processor';
import { ReminderScheduler } from './reminder.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reminder, Pet, VaccinationSchedule, User]),
    BullModule.registerQueue({ name: 'reminders' }),
    NotificationsModule,
  ],
  controllers: [RemindersController],
  providers: [ReminderService, BatchProcessingService, ReminderProcessor, ReminderScheduler],
  exports: [ReminderService, BatchProcessingService],
})
export class RemindersModule {}
