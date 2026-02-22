import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Pet } from './entities/pet.entity';
import { Breed } from './entities/breed.entity';
import { PetPhoto } from './entities/pet-photo.entity';
import { PetShare } from './entities/pet-share.entity';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([Pet, Breed, PetPhoto]),
    MulterModule.register({ storage: require('multer').memoryStorage() }),
    ProcessingModule,
    forwardRef(() => LostPetsModule),
    AuthModule,
    UsersModule,
  ],
  controllers: [PetsController, PetPhotosController, BreedsController],
  providers: [PetsService, PetPhotosService, BreedsService, BreedsSeeder],
  exports: [PetsService, PetPhotosService, BreedsService],
})
export class PetsModule {}
