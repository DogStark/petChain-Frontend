import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
<<<<<<< HEAD
import { VaccinationsService } from './vaccinations.service';
import { VaccinationsController } from './vaccinations.controller';
import { Vaccination } from './entities/vaccination.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vaccination])],
  controllers: [VaccinationsController],
  providers: [VaccinationsService],
  exports: [VaccinationsService],
=======
import { Vaccination } from './entities/vaccination.entity';
import { VaccinationSchedule } from './entities/vaccination-schedule.entity';
import { VaccinationsService } from './vaccinations.service';
import { VaccinationSchedulesService } from './vaccination-schedules.service';
import { VaccinationsController } from './vaccinations.controller';
import { VaccinationSchedulesController } from './vaccination-schedules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Vaccination, VaccinationSchedule])],
  controllers: [VaccinationsController, VaccinationSchedulesController],
  providers: [VaccinationsService, VaccinationSchedulesService],
  exports: [VaccinationsService, VaccinationSchedulesService],
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
})
export class VaccinationsModule {}
