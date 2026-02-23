import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { Breed } from './entities/breed.entity';
import { PetPhoto } from './entities/pet-photo.entity';
import { TimelineShare } from './entities/timeline-share.entity';
import { PetsService } from './pets.service';
import { BreedsService } from './breeds.service';
import { PetsController } from './pets.controller';
import { BreedsController } from './breeds.controller';
import { BreedsSeeder } from './seeds/breeds.seed';

// Timeline-related imports
import { Vaccination } from '../vaccinations/entities/vaccination.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Prescription } from '../prescriptions/entities/prescription.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Allergy } from '../allergies/entities/allergy.entity';
import { PetTimelineService } from './services/pet-timeline.service';
import { PetTimelineController } from './controllers/pet-timeline.controller';
import { SharedTimelineController } from './controllers/shared-timeline.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pet,
      Breed,
      PetPhoto,
      TimelineShare,
      // Timeline-related entities
      Vaccination,
      MedicalRecord,
      Prescription,
      Appointment,
      Allergy,
    ]),
  ],
  controllers: [PetsController, BreedsController, PetTimelineController, SharedTimelineController],
  providers: [PetsService, BreedsService, BreedsSeeder, PetTimelineService],
  exports: [PetsService, BreedsService, PetTimelineService],
})
export class PetsModule {}
