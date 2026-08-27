import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsController } from './prescriptions.controller';
import { MedicationsController } from './medications.controller';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionRefill } from './entities/prescription-refill.entity';
import { Medication } from './entities/medication.entity';
import { DrugInteraction } from './entities/drug-interaction.entity';
import { DosageCalculationService } from './services/dosage-calculation.service';
import { DrugInteractionService } from './services/drug-interaction.service';
import { MedicationService } from './services/medication.service';
import { PrescriptionReminderScheduler } from './prescription-reminder.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';
import { RedisService } from '../../auth/services/redis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prescription,
      PrescriptionRefill,
      Medication,
      DrugInteraction,
    ]),
    NotificationsModule,
  ],
  controllers: [PrescriptionsController, MedicationsController],
  providers: [
    PrescriptionsService,
    DosageCalculationService,
    DrugInteractionService,
    MedicationService,
    PrescriptionReminderScheduler,
    RedisService,
  ],
  exports: [
    PrescriptionsService,
    DosageCalculationService,
    DrugInteractionService,
    MedicationService,
  ],
})
export class PrescriptionsModule {}
