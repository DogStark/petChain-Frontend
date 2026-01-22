import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaccinationsService } from './vaccinations.service';
import { VaccinationsController } from './vaccinations.controller';
import { Vaccination } from './entities/vaccination.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vaccination])],
  controllers: [VaccinationsController],
  providers: [VaccinationsService],
  exports: [VaccinationsService],
})
export class VaccinationsModule {}
