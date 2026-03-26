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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prescription,
      PrescriptionRefill,
      Medication,
      DrugInteraction,
    ]),
  ],
  controllers: [PrescriptionsController, MedicationsController],
  providers: [
    PrescriptionsService,
    DosageCalculationService,
    DrugInteractionService,
    MedicationService,
  ],
  exports: [
    PrescriptionsService,
    DosageCalculationService,
    DrugInteractionService,
    MedicationService,
  ],
})
export class PrescriptionsModule {}
