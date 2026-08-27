import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISearchStrategy } from './interfaces/search-strategy.interface';

export const POSTGRES_SEARCH_STRATEGY = 'POSTGRES_SEARCH_STRATEGY';
export const ELASTICSEARCH_SEARCH_STRATEGY = 'ELASTICSEARCH_SEARCH_STRATEGY';

@Injectable()
export class SearchStrategyFactory {
  private readonly logger = new Logger(SearchStrategyFactory.name);
  private readonly activeStrategy: ISearchStrategy;

  constructor(
    private readonly configService: ConfigService,
    @Inject(POSTGRES_SEARCH_STRATEGY)
    private readonly postgresStrategy: ISearchStrategy,
    @Optional()
    @Inject(ELASTICSEARCH_SEARCH_STRATEGY)
    private readonly elasticsearchStrategy: ISearchStrategy | null,
  ) {
    const esUrl = this.configService.get<string>('ELASTICSEARCH_URL');

    if (esUrl && this.elasticsearchStrategy) {
      this.activeStrategy = this.elasticsearchStrategy;
      this.logger.log('Search strategy: Elasticsearch');
    } else {
      this.activeStrategy = this.postgresStrategy;
      this.logger.log('Search strategy: PostgreSQL (full-text)');
    }
  }

  getStrategy(): ISearchStrategy {
    return this.activeStrategy;
  }
}
