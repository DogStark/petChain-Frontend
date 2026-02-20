import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vaccination } from './entities/vaccination.entity';
import { VaccinationSchedule } from './entities/vaccination-schedule.entity';
import { VaccinationReaction } from './entities/vaccination-reaction.entity';
import { VaccinationsService } from './vaccinations.service';
import { VaccinationSchedulesService } from './vaccination-schedules.service';
import { VaccinationCertificateService } from './services/vaccination-certificate.service';
import { VaccinationReminderService } from './services/vaccination-reminder.service';
import { VaccinationsController } from './vaccinations.controller';
import { VaccinationSchedulesController } from './vaccination-schedules.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vaccination,
      VaccinationSchedule,
      VaccinationReaction,
    ]),
  ],
  controllers: [VaccinationsController, VaccinationSchedulesController],
  providers: [
    VaccinationsService,
    VaccinationSchedulesService,
    VaccinationCertificateService,
    VaccinationReminderService,
  ],
  exports: [
    VaccinationsService,
    VaccinationSchedulesService,
    VaccinationCertificateService,
    VaccinationReminderService,
  ],
})
export class VaccinationsModule {}
