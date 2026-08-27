import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchAnalyticsService } from './search-analytics.service';
import { IndexingService } from './indexing.service';
import {
  SearchStrategyFactory,
  POSTGRES_SEARCH_STRATEGY,
  ELASTICSEARCH_SEARCH_STRATEGY,
} from './search-strategy.factory';
import { PostgresSearchStrategy } from './strategies/postgres-search.strategy';
import { ElasticsearchSearchStrategy } from './strategies/elasticsearch-search.strategy';
import { SearchAnalytics } from './entities/search-analytics.entity';
import { Pet } from '../pets/entities/pet.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Vet } from '../vets/entities/vet.entity';
import { EmergencyService } from '../emergency-services/entities/emergency-service.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Pet,
      MedicalRecord,
      Vet,
      EmergencyService,
      SearchAnalytics,
    ]),
  ],
  controllers: [SearchController],
  providers: [
    SearchService,
    SearchAnalyticsService,
    IndexingService,
    SearchStrategyFactory,
    PostgresSearchStrategy,
    ElasticsearchSearchStrategy,
    {
      provide: POSTGRES_SEARCH_STRATEGY,
      useClass: PostgresSearchStrategy,
    },
    {
      provide: ELASTICSEARCH_SEARCH_STRATEGY,
      useClass: ElasticsearchSearchStrategy,
    },
  ],
  exports: [SearchService, SearchAnalyticsService, IndexingService],
})
export class SearchModule {}
