import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllergiesService } from './allergies.service';
import { AllergiesController } from './allergies.controller';
import { Allergy } from './entities/allergy.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Allergy])],
  controllers: [AllergiesController],
  providers: [AllergiesService],
  exports: [AllergiesService],
})
export class AllergiesModule {}
