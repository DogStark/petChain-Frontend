import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchAnalytics } from './entities/search-analytics.entity';
import { Pet } from '../pets/entities/pet.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Vet } from '../vets/entities/vet.entity';
import { EmergencyService } from '../emergency-services/entities/emergency-service.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pet,
      MedicalRecord,
      Vet,
      EmergencyService,
      SearchAnalytics,
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
