import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { User } from '../users/entities/user.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Vaccination } from '../vaccinations/entities/vaccination.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { UserActivityLog } from '../users/entities/user-activity-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Pet,
      Vaccination,
      Appointment,
      MedicalRecord,
      UserActivityLog,
    ]),
    CacheModule.register({
      ttl: 5 * 60 * 1000,
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
