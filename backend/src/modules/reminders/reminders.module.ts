import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaccinationReminder } from './entities/vaccination-reminder.entity';
import { Pet } from '../pets/entities/pet.entity';
import { VaccinationSchedule } from '../vaccinations/entities/vaccination-schedule.entity';
import { ReminderService } from './reminder.service';
import { BatchProcessingService } from './batch-processing.service';
import { RemindersController } from './reminders.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([VaccinationReminder, Pet, VaccinationSchedule]),
  ],
  controllers: [RemindersController],
  providers: [ReminderService, BatchProcessingService],
  exports: [ReminderService, BatchProcessingService],
})
export class RemindersModule {}
