import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchAnalytics } from './entities/search-analytics.entity';
import { PopularQuery } from './interfaces/search-result.interface';

export interface SearchEvent {
  query: string;
  searchType: string;
  resultsCount: number;
  responseTime: number;
  filters?: Record<string, any>;
  wasSuccessful: boolean;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AnalyticsSummary {
  totalSearches: number;
  successfulSearches: number;
  successRate: number;
  avgResponseTime: number;
  searchesByType: Record<string, number>;
}

@Injectable()
export class SearchAnalyticsService {
  private readonly logger = new Logger(SearchAnalyticsService.name);

  constructor(
    @InjectRepository(SearchAnalytics)
    private readonly analyticsRepo: Repository<SearchAnalytics>,
  ) {}

  async track(event: SearchEvent): Promise<void> {
    try {
      const record = this.analyticsRepo.create({
        query: event.query,
        searchType: event.searchType,
        resultsCount: event.resultsCount,
        responseTime: event.responseTime,
        filters: event.filters,
        wasSuccessful: event.wasSuccessful,
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      });
      await this.analyticsRepo.save(record);
    } catch (err) {
      this.logger.error('Failed to track search event', err);
    }
  }

  async getAnalytics(days: number): Promise<AnalyticsSummary> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const records = await this.analyticsRepo
      .createQueryBuilder('sa')
      .where('sa.createdAt >= :since', { since })
      .getMany();

    const totalSearches = records.length;
    const successfulSearches = records.filter((r) => r.wasSuccessful).length;
    const successRate =
      totalSearches === 0 ? 0 : successfulSearches / totalSearches;
    const avgResponseTime =
      totalSearches === 0
        ? 0
        : records.reduce((sum, r) => sum + Number(r.responseTime), 0) /
          totalSearches;

    const searchesByType: Record<string, number> = {};
    for (const record of records) {
      searchesByType[record.searchType] =
        (searchesByType[record.searchType] ?? 0) + 1;
    }

    return {
      totalSearches,
      successfulSearches,
      successRate,
      avgResponseTime,
      searchesByType,
    };
  }

  async getPopularQueries(limit: number): Promise<PopularQuery[]> {
    const rows = await this.analyticsRepo
      .createQueryBuilder('sa')
      .select('sa.query', 'query')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(sa.createdAt)', 'lastSearched')
      .where('sa.wasSuccessful = :success', { success: true })
      .andWhere("sa.query != ''")
      .groupBy('sa.query')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany<{ query: string; count: string; lastSearched: string }>();

    return rows.map((row) => ({
      query: row.query,
      count: parseInt(row.count, 10),
      lastSearched: new Date(row.lastSearched),
    }));
  }
}
