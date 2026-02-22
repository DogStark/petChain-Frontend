import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { Breed } from './entities/breed.entity';
import { PetPhoto } from './entities/pet-photo.entity';
import { PetShare } from './entities/pet-share.entity';
import { PetsService } from './pets.service';
import { BreedsService } from './breeds.service';
import { PetsController } from './pets.controller';
import { BreedsController } from './breeds.controller';
import { BreedsSeeder } from './seeds/breeds.seed';
import { LostPetsModule } from '../lost-pets/lost-pets.module';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pet, Breed, PetPhoto, PetShare]),
    forwardRef(() => LostPetsModule),
    AuthModule,
    UsersModule,
  ],
  controllers: [PetsController, BreedsController],
  providers: [PetsService, BreedsService, BreedsSeeder],
  exports: [PetsService, BreedsService],
})
export class PetsModule {}
