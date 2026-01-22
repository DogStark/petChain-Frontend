import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
})
export class PetsModule {}
