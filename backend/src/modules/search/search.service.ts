import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyService } from '../emergency-services/entities/emergency-service.entity';
import { SearchAnalytics } from './entities/search-analytics.entity';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  SearchResult,
  AutocompleteResult,
  PopularQuery,
} from './interfaces/search-result.interface';
import { SearchStrategyFactory } from './search-strategy.factory';
import { SearchAnalyticsService } from './search-analytics.service';
import { IndexingService } from './indexing.service';
import { Pet } from '../pets/entities/pet.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Vet } from '../vets/entities/vet.entity';
import { AnalyticsSummary } from './search-analytics.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly strategyFactory: SearchStrategyFactory,
    private readonly analyticsService: SearchAnalyticsService,
    private readonly indexingService: IndexingService,
    @InjectRepository(EmergencyService)
    private readonly emergencyServiceRepository: Repository<EmergencyService>,
    @InjectRepository(SearchAnalytics)
    private readonly searchAnalyticsRepository: Repository<SearchAnalytics>,
  ) {}

  async searchPets(queryDto: SearchQueryDto): Promise<SearchResult<Pet>> {
    const startTime = Date.now();
    const result = await this.strategyFactory.getStrategy().searchPets(queryDto);
    const searchTime = Date.now() - startTime;

    this.analyticsService
      .track({
        query: queryDto.query || '',
        searchType: 'pets',
        resultsCount: result.total,
        responseTime: searchTime,
        filters: queryDto,
        wasSuccessful: result.total > 0,
      })
      .catch(() => {});

    return result;
  }

  async searchVets(queryDto: SearchQueryDto): Promise<SearchResult<Vet>> {
    const hasLat = queryDto.latitude !== undefined && queryDto.latitude !== null;
    const hasLng = queryDto.longitude !== undefined && queryDto.longitude !== null;
    if (hasLat !== hasLng) {
      throw new BadRequestException('Both latitude and longitude must be provided together');
    }

    const startTime = Date.now();
    const result = await this.strategyFactory.getStrategy().searchVets(queryDto);
    const searchTime = Date.now() - startTime;

    this.analyticsService
      .track({
        query: queryDto.query || '',
        searchType: 'vets',
        resultsCount: result.total,
        responseTime: searchTime,
        filters: queryDto,
        wasSuccessful: result.total > 0,
      })
      .catch(() => {});

    return result;
  }

  async searchMedicalRecords(queryDto: SearchQueryDto): Promise<SearchResult<MedicalRecord>> {
    const startTime = Date.now();
    const result = await this.strategyFactory.getStrategy().searchMedicalRecords(queryDto);
    const searchTime = Date.now() - startTime;

    this.analyticsService
      .track({
        query: queryDto.query || '',
        searchType: 'medical-records',
        resultsCount: result.total,
        responseTime: searchTime,
        filters: queryDto,
        wasSuccessful: result.total > 0,
      })
      .catch(() => {});

    return result;
  }

  async searchEmergencyServices(
    queryDto: SearchQueryDto,
  ): Promise<SearchResult<EmergencyService>> {
    const startTime = Date.now();
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder =
      this.emergencyServiceRepository.createQueryBuilder('service');

    if (queryDto.query) {
      queryBuilder.where(
        `(
          service.name ILIKE :query OR 
          service.serviceType ILIKE :query OR 
          service.description ILIKE :query OR
          service.location ILIKE :query OR
          service.address ILIKE :query
        )`,
        { query: `%${queryDto.query}%` },
      );
    }

    if (queryDto.serviceType) {
      queryBuilder.andWhere('service.serviceType ILIKE :serviceType', {
        serviceType: `%${queryDto.serviceType}%`,
      });
    }

    if (queryDto.is24Hours !== undefined) {
      queryBuilder.andWhere('service.is24Hours = :is24Hours', {
        is24Hours: queryDto.is24Hours,
      });
    }

    if (queryDto.location) {
      queryBuilder.andWhere('service.location ILIKE :location', {
        location: `%${queryDto.location}%`,
      });
    }

    if (queryDto.latitude && queryDto.longitude) {
      const radius = queryDto.radius || 50;
      queryBuilder
        .addSelect(
          `(
          6371 * acos(
            cos(radians(:lat)) * cos(radians(service.latitude)) *
            cos(radians(service.longitude) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(service.latitude))
          )
        )`,
          'distance',
        )
        .where(
          `(
          6371 * acos(
            cos(radians(:lat)) * cos(radians(service.latitude)) *
            cos(radians(service.longitude) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(service.latitude))
          )
        ) <= :radius`,
          {
            lat: queryDto.latitude,
            lng: queryDto.longitude,
            radius,
          },
        )
        .orderBy('distance', 'ASC');
    }

    if (!queryDto.includeInactive) {
      queryBuilder.andWhere('service.status != :status', { status: 'closed' });
    }

    if (!queryDto.latitude && !queryDto.longitude) {
      if (queryDto.sortBy === 'rating') {
        queryBuilder.orderBy('service.rating', 'DESC');
      } else {
        queryBuilder.orderBy('service.is24Hours', 'DESC');
        queryBuilder.addOrderBy('service.rating', 'DESC');
      }
    }

    const [results, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const searchTime = Date.now() - startTime;

    this.analyticsService
      .track({
        query: queryDto.query || '',
        searchType: 'emergency-services',
        resultsCount: total,
        responseTime: searchTime,
        filters: queryDto,
        wasSuccessful: total > 0,
      })
      .catch(() => {});

    return {
      results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchTime,
      filters: queryDto,
    };
  }

  async globalSearch(queryDto: SearchQueryDto): Promise<any> {
    const startTime = Date.now();

    const [pets, vets, medicalRecords, emergencyServices] = await Promise.all([
      this.searchPets({ ...queryDto, limit: 5 }),
      this.searchVets({ ...queryDto, limit: 5 }),
      this.searchMedicalRecords({ ...queryDto, limit: 5 }),
      this.searchEmergencyServices({ ...queryDto, limit: 5 }),
    ]);

    const searchTime = Date.now() - startTime;

    this.analyticsService
      .track({
        query: queryDto.query || '',
        searchType: 'global',
        resultsCount:
          pets.total + vets.total + medicalRecords.total + emergencyServices.total,
        responseTime: searchTime,
        filters: queryDto,
        wasSuccessful:
          pets.total > 0 ||
          vets.total > 0 ||
          medicalRecords.total > 0 ||
          emergencyServices.total > 0,
      })
      .catch(() => {});

    return {
      pets,
      vets,
      medicalRecords,
      emergencyServices,
      searchTime,
    };
  }

  async autocomplete(query: string, type?: string): Promise<AutocompleteResult> {
    const suggestions = await this.strategyFactory.getStrategy().autocomplete(query, type);
    const popular = await this.analyticsService.getPopularQueries(10);

    return {
      suggestions,
      popular: popular.map((q) => q.query),
    };
  }

  async getPopularQueries(limit = 10): Promise<PopularQuery[]> {
    return this.analyticsService.getPopularQueries(limit);
  }

  async getSearchAnalytics(days = 7): Promise<AnalyticsSummary> {
    return this.analyticsService.getAnalytics(days);
  }
}
