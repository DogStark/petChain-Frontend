import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
<<<<<<< HEAD
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { Pet } from './entities/pet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pet])],
  controllers: [PetsController],
  providers: [PetsService],
  exports: [PetsService],
=======
import { Pet } from './entities/pet.entity';
import { Breed } from './entities/breed.entity';
import { PetsService } from './pets.service';
import { BreedsService } from './breeds.service';
import { PetsController } from './pets.controller';
import { BreedsController } from './breeds.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pet, Breed])],
  controllers: [PetsController, BreedsController],
  providers: [PetsService, BreedsService],
  exports: [PetsService, BreedsService],
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
})
export class PetsModule {}
