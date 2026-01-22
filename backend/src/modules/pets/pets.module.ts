import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { Breed } from './entities/breed.entity';
import { PetPhoto } from './entities/pet-photo.entity';
import { PetsService } from './pets.service';
import { BreedsService } from './breeds.service';
import { PetsController } from './pets.controller';
import { BreedsController } from './breeds.controller';
import { BreedsSeeder } from './seeds/breeds.seed';

@Module({
  imports: [TypeOrmModule.forFeature([Pet, Breed, PetPhoto])],
  controllers: [PetsController, BreedsController],
  providers: [PetsService, BreedsService, BreedsSeeder],
  exports: [PetsService, BreedsService],
})
export class PetsModule {}
