import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vaccination } from './entities/vaccination.entity';
import { VaccinationSchedule } from './entities/vaccination-schedule.entity';
import { VaccinationsService } from './vaccinations.service';
import { VaccinationSchedulesService } from './vaccination-schedules.service';
import { VaccinationsController } from './vaccinations.controller';
import { VaccinationSchedulesController } from './vaccination-schedules.controller';
import { VaccinationAdverseReaction } from './entities/vaccination-adverse-reaction.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Reminder } from '../reminders/entities/reminder.entity';
import { RemindersModule } from '../reminders/reminders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vaccination,
      VaccinationSchedule,
      VaccinationAdverseReaction,
      Pet,
      Reminder,
    ]),
    RemindersModule,
  ],
  controllers: [VaccinationsController, VaccinationSchedulesController],
  providers: [VaccinationsService, VaccinationSchedulesService],
  exports: [VaccinationsService, VaccinationSchedulesService],
})
export class VaccinationsModule {}
