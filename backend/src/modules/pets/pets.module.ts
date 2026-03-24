import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Pet } from './entities/pet.entity';
import { Breed } from './entities/breed.entity';
import { PetPhoto } from './entities/pet-photo.entity';
import { PetShare } from './entities/pet-share.entity';
import { TimelineShare } from './entities/timeline-share.entity';
import { PetsService } from './pets.service';
import { PetPhotosService } from './pet-photos.service';
import { BreedsService } from './breeds.service';
import { PetsController } from './pets.controller';
import { PetPhotosController } from './pet-photos.controller';
import { BreedsController } from './breeds.controller';
import { BreedsSeeder } from './seeds/breeds.seed';
import { ProcessingModule } from '../processing/processing.module';
import { LostPetsModule } from '../lost-pets/lost-pets.module';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../users/users.module';

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
      PetShare,
      TimelineShare,
      // Timeline-related entities
      Vaccination,
      MedicalRecord,
      Prescription,
      Appointment,
      Allergy,
    ]),
    MulterModule.register({ storage: require('multer').memoryStorage() }),
    ProcessingModule,
    forwardRef(() => LostPetsModule),
    AuthModule,
    UsersModule,
  ],
  controllers: [PetsController, PetPhotosController, BreedsController, PetTimelineController, SharedTimelineController],
  providers: [PetsService, PetPhotosService, BreedsService, BreedsSeeder, PetTimelineService],
  exports: [PetsService, PetPhotosService, BreedsService, PetTimelineService],
})
export class PetsModule {}