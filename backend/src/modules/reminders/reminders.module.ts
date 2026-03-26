import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reminder } from './entities/reminder.entity';
import { Pet } from '../pets/entities/pet.entity';
import { VaccinationSchedule } from '../vaccinations/entities/vaccination-schedule.entity';
import { User } from '../users/entities/user.entity';
import { ReminderService } from './reminder.service';
import { BatchProcessingService } from './batch-processing.service';
import { RemindersController } from './reminders.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reminder, Pet, VaccinationSchedule, User]),
  ],
  controllers: [RemindersController],
  providers: [ReminderService, BatchProcessingService],
  exports: [ReminderService, BatchProcessingService],
})
export class RemindersModule {}
