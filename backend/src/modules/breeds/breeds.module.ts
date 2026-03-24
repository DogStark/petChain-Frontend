import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BreedsService } from './breeds.service';
import { BreedsController } from './breeds.controller';
import { BreedsSeederService } from './seeds/breeds-seeder.service';
import { Breed } from './entities/breed.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Breed])],
  controllers: [BreedsController],
  providers: [BreedsService, BreedsSeederService],
  exports: [BreedsService, BreedsSeederService],
})
export class BreedsModule {}