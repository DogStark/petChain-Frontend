import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Between } from 'typeorm';
import { Pet } from '../pets/entities/pet.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Vet } from '../vets/entities/vet.entity';
import { EmergencyService } from '../emergency-services/entities/emergency-service.entity';
import { SearchAnalytics } from './entities/search-analytics.entity';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  SearchResult,
  AutocompleteResult,
  PopularQuery,
} from './interfaces/search-result.interface';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(Vet)
    private readonly vetRepository: Repository<Vet>,
    @InjectRepository(EmergencyService)
    private readonly emergencyServiceRepository: Repository<EmergencyService>,
    @InjectRepository(SearchAnalytics)
    private readonly searchAnalyticsRepository: Repository<SearchAnalytics>,
  ) {}

  async searchPets(queryDto: SearchQueryDto): Promise<SearchResult<Pet>> {
    const startTime = Date.now();
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.petRepository
      .createQueryBuilder('pet')
      .leftJoinAndSelect('pet.owner', 'owner')
      .leftJoinAndSelect('pet.breed', 'breed');

    // Full-text search
    if (queryDto.query) {
      queryBuilder.where(
        `(
          pet.name ILIKE :query OR 
          breed.name ILIKE :query OR 
          pet.species::text ILIKE :query OR 
          pet.color ILIKE :query OR
          pet.microchipNumber ILIKE :query
        )`,
        { query: `%${queryDto.query}%` },
      );
    }

    // Apply filters
    if (queryDto.breed) {
      queryBuilder.andWhere('breed.name ILIKE :breed', {
        breed: `%${queryDto.breed}%`,
      });
    }

    if (queryDto.minAge !== undefined || queryDto.maxAge !== undefined) {
      const currentDate = new Date();
      
      if (queryDto.minAge !== undefined) {
        const maxDate = new Date();
        maxDate.setFullYear(currentDate.getFullYear() - queryDto.minAge);
        queryBuilder.andWhere('pet.dateOfBirth <= :maxDate', { maxDate });
      }
      
      if (queryDto.maxAge !== undefined) {
        const minDate = new Date();
        minDate.setFullYear(currentDate.getFullYear() - queryDto.maxAge - 1);
        queryBuilder.andWhere('pet.dateOfBirth > :minDate', { minDate });
      }
    }

    // Note: Location/geolocation removed as Pet entity no longer has latitude/longitude fields

    // Status filter (use isActive instead of status)
    if (!queryDto.includeInactive) {
      queryBuilder.andWhere('pet.isActive = :isActive', { isActive: true });
    }

    // Sorting
    const sortBy = queryDto.sortBy || 'createdAt';
    const sortOrder: 'ASC' | 'DESC' =
      (queryDto.sortOrder as 'ASC' | 'DESC') || 'DESC';
    queryBuilder.orderBy(`pet.${sortBy}`, sortOrder);

    // Execute query
    const [results, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const searchTime = Date.now() - startTime;

    // Track analytics
    await this.trackSearch({
      query: queryDto.query || '',
      searchType: 'pets',
      resultsCount: total,
      responseTime: searchTime,
      filters: queryDto,
      wasSuccessful: total > 0,
    });

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

  async searchVets(queryDto: SearchQueryDto): Promise<SearchResult<Vet>> {
    const startTime = Date.now();
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.vetRepository.createQueryBuilder('vet');

    // Full-text search
    if (queryDto.query) {
      queryBuilder.where(
        `(
          vet.name ILIKE :query OR 
          vet.specialty ILIKE :query OR 
          vet.clinicName ILIKE :query OR 
          vet.bio ILIKE :query OR
          vet.location ILIKE :query
        )`,
        { query: `%${queryDto.query}%` },
      );
    }

    // Apply filters
    if (queryDto.specialty) {
      queryBuilder.andWhere(
        `(
          vet.specialty ILIKE :specialty OR 
          :specialty = ANY(vet.specialties)
        )`,
        { specialty: `%${queryDto.specialty}%` },
      );
    }

    if (queryDto.location) {
      queryBuilder.andWhere('vet.location ILIKE :location', {
        location: `%${queryDto.location}%`,
      });
    }

    // Geolocation search
    if (queryDto.latitude && queryDto.longitude && queryDto.radius) {
      queryBuilder.andWhere(
        `(
          6371 * acos(
            cos(radians(:lat)) * cos(radians(vet.latitude)) *
            cos(radians(vet.longitude) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(vet.latitude))
          )
        ) <= :radius`,
        {
          lat: queryDto.latitude,
          lng: queryDto.longitude,
          radius: queryDto.radius,
        },
      );
    }

    // Status filter
    if (!queryDto.includeInactive) {
      queryBuilder.andWhere('vet.status = :status', { status: 'active' });
      queryBuilder.andWhere('vet.isAvailable = :isAvailable', {
        isAvailable: true,
      });
    }

    // Sorting
    if (queryDto.sortBy === 'rating') {
      queryBuilder.orderBy('vet.rating', 'DESC');
    } else if (queryDto.sortBy === 'name') {
      queryBuilder.orderBy('vet.name', 'ASC');
    } else {
      queryBuilder.orderBy('vet.createdAt', 'DESC');
    }

    // Execute query
    const [results, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const searchTime = Date.now() - startTime;

    await this.trackSearch({
      query: queryDto.query || '',
      searchType: 'vets',
      resultsCount: total,
      responseTime: searchTime,
      filters: queryDto,
      wasSuccessful: total > 0,
    });

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

  async searchMedicalRecords(
    queryDto: SearchQueryDto,
  ): Promise<SearchResult<MedicalRecord>> {
    const startTime = Date.now();
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.medicalRecordRepository
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.pet', 'pet')
      .leftJoinAndSelect('record.vet', 'vet');

    // Full-text search
    if (queryDto.query) {
      queryBuilder.where(
        `(
          record.condition ILIKE :query OR 
          record.treatment ILIKE :query OR 
          record.diagnosis ILIKE :query OR 
          record.notes ILIKE :query OR
          record.vetName ILIKE :query OR
          record.clinicName ILIKE :query
        )`,
        { query: `%${queryDto.query}%` },
      );
    }

    // Apply filters
    if (queryDto.condition) {
      queryBuilder.andWhere('record.condition ILIKE :condition', {
        condition: `%${queryDto.condition}%`,
      });
    }

    if (queryDto.treatment) {
      queryBuilder.andWhere('record.treatment ILIKE :treatment', {
        treatment: `%${queryDto.treatment}%`,
      });
    }

    // Status filter
    if (!queryDto.includeInactive) {
      queryBuilder.andWhere('record.status = :status', { status: 'active' });
    }

    // Sorting
    queryBuilder.orderBy('record.recordDate', 'DESC');

    // Execute query
    const [results, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const searchTime = Date.now() - startTime;

    await this.trackSearch({
      query: queryDto.query || '',
      searchType: 'medical-records',
      resultsCount: total,
      responseTime: searchTime,
      filters: queryDto,
      wasSuccessful: total > 0,
    });

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

  async searchEmergencyServices(
    queryDto: SearchQueryDto,
  ): Promise<SearchResult<EmergencyService>> {
    const startTime = Date.now();
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder =
      this.emergencyServiceRepository.createQueryBuilder('service');

    // Full-text search
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

    // Apply filters
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

    // Geolocation search (priority for emergency services)
    if (queryDto.latitude && queryDto.longitude) {
      const radius = queryDto.radius || 50; // Default 50km for emergency
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

    // Status filter
    if (!queryDto.includeInactive) {
      queryBuilder.andWhere('service.status != :status', { status: 'closed' });
    }

    // Sorting (if not distance-based)
    if (!queryDto.latitude && !queryDto.longitude) {
      if (queryDto.sortBy === 'rating') {
        queryBuilder.orderBy('service.rating', 'DESC');
      } else {
        queryBuilder.orderBy('service.is24Hours', 'DESC');
        queryBuilder.addOrderBy('service.rating', 'DESC');
      }
    }

    // Execute query
    const [results, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const searchTime = Date.now() - startTime;

    await this.trackSearch({
      query: queryDto.query || '',
      searchType: 'emergency-services',
      resultsCount: total,
      responseTime: searchTime,
      filters: queryDto,
      wasSuccessful: total > 0,
    });

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

    await this.trackSearch({
      query: queryDto.query || '',
      searchType: 'global',
      resultsCount:
        pets.total +
        vets.total +
        medicalRecords.total +
        emergencyServices.total,
      responseTime: searchTime,
      filters: queryDto,
      wasSuccessful:
        pets.total > 0 ||
        vets.total > 0 ||
        medicalRecords.total > 0 ||
        emergencyServices.total > 0,
    });

    return {
      pets,
      vets,
      medicalRecords,
      emergencyServices,
      searchTime,
    };
  }

  async autocomplete(
    query: string,
    type?: string,
  ): Promise<AutocompleteResult> {
    const suggestions: string[] = [];
    const popularQueries = await this.getPopularQueries(10);

    if (!query || query.length < 2) {
      return {
        suggestions: [],
        popular: popularQueries.map((q) => q.query),
      };
    }

    // Get suggestions based on type
    if (!type || type === 'pets') {
      const pets = await this.petRepository
        .createQueryBuilder('pet')
        .select('DISTINCT pet.breed', 'value')
        .where('pet.breed ILIKE :query', { query: `%${query}%` })
        .limit(5)
        .getRawMany();
      suggestions.push(...pets.map((p) => p.value));
    }

    if (!type || type === 'vets') {
      const vets = await this.vetRepository
        .createQueryBuilder('vet')
        .select('DISTINCT vet.specialty', 'value')
        .where('vet.specialty ILIKE :query', { query: `%${query}%` })
        .limit(5)
        .getRawMany();
      suggestions.push(...vets.map((v) => v.value));
    }

    if (!type || type === 'medical-records') {
      const conditions = await this.medicalRecordRepository
        .createQueryBuilder('record')
        .select('DISTINCT record.condition', 'value')
        .where('record.condition ILIKE :query', { query: `%${query}%` })
        .limit(5)
        .getRawMany();
      suggestions.push(...conditions.map((c) => c.value));
    }

    return {
      suggestions: [...new Set(suggestions)].slice(0, 10),
      popular: popularQueries.map((q) => q.query),
    };
  }

  async getPopularQueries(limit = 10): Promise<PopularQuery[]> {
    const results = await this.searchAnalyticsRepository
      .createQueryBuilder('analytics')
      .select('analytics.query', 'query')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(analytics.createdAt)', 'lastSearched')
      .where('analytics.wasSuccessful = :wasSuccessful', {
        wasSuccessful: true,
      })
      .andWhere('analytics.query IS NOT NULL')
      .andWhere("analytics.query != ''")
      .groupBy('analytics.query')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      query: r.query,
      count: parseInt(r.count),
      lastSearched: r.lastSearched,
    }));
  }

  async getSearchAnalytics(days = 7): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await this.searchAnalyticsRepository
      .createQueryBuilder('analytics')
      .where('analytics.createdAt >= :startDate', { startDate })
      .getMany();

    const totalSearches = analytics.length;
    const successfulSearches = analytics.filter((a) => a.wasSuccessful).length;
    const avgResponseTime =
      analytics.reduce((sum, a) => sum + Number(a.responseTime), 0) /
      totalSearches;

    const searchesByType = analytics.reduce(
      (acc, a) => {
        acc[a.searchType] = (acc[a.searchType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalSearches,
      successfulSearches,
      successRate: (successfulSearches / totalSearches) * 100,
      avgResponseTime,
      searchesByType,
      popularQueries: await this.getPopularQueries(),
    };
  }

  private async trackSearch(data: {
    query: string;
    searchType: string;
    resultsCount: number;
    responseTime: number;
    filters: any;
    wasSuccessful: boolean;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const analytics = this.searchAnalyticsRepository.create(data);
      await this.searchAnalyticsRepository.save(analytics);
    } catch (error) {
      // Log error but don't fail the search
      console.error('Failed to track search analytics:', error);
    }
  }
}
