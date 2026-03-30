// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { ISearchStrategy } from '../interfaces/search-strategy.interface';
import { SearchQueryDto } from '../dto/search-query.dto';
import {
  SearchResult,
  FacetCount,
} from '../interfaces/search-result.interface';

@Injectable()
export class ElasticsearchSearchStrategy implements ISearchStrategy {
  private readonly client: Client;
  private readonly logger = new Logger(ElasticsearchSearchStrategy.name);

  constructor(private readonly configService: ConfigService) {
    const node =
      this.configService.get<string>('ELASTICSEARCH_URL') ??
      'http://localhost:9200';
    const apiKey = this.configService.get<string>('ELASTICSEARCH_API_KEY');

    this.client = new Client({
      node,
      ...(apiKey ? { auth: { apiKey } } : {}),
    });
  }

  async searchPets(dto: SearchQueryDto): Promise<SearchResult> {
    const start = Date.now();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const from = (page - 1) * limit;

    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    if (dto.query) {
      mustClauses.push({
        multi_match: {
          query: dto.query,
          fields: ['name^3', 'species^2', 'breed', 'color', 'microchipNumber'],
        },
      });
    } else {
      mustClauses.push({ match_all: {} });
    }

    if (dto.breed) {
      filterClauses.push({ term: { 'breed.keyword': dto.breed } });
    }

    if (dto.species) {
      filterClauses.push({ term: { species: dto.species } });
    }

    if (dto.gender) {
      filterClauses.push({ term: { gender: dto.gender } });
    }

    if (dto.minAge !== undefined || dto.maxAge !== undefined) {
      const now = new Date();
      const rangeFilter: any = {};
      if (dto.maxAge !== undefined) {
        const minDob = new Date(now);
        minDob.setFullYear(minDob.getFullYear() - dto.maxAge - 1);
        rangeFilter.gte = minDob.toISOString().split('T')[0];
      }
      if (dto.minAge !== undefined) {
        const maxDob = new Date(now);
        maxDob.setFullYear(maxDob.getFullYear() - dto.minAge);
        rangeFilter.lte = maxDob.toISOString().split('T')[0];
      }
      filterClauses.push({ range: { dateOfBirth: rangeFilter } });
    }

    if (!dto.includeInactive) {
      filterClauses.push({ term: { isActive: true } });
    }

    try {
      const response = await (this.client as any).search({
        index: 'pets',
        from,
        size: limit,
        body: {
          query: {
            bool: {
              must: mustClauses,
              filter: filterClauses,
            },
          },
          aggs: {
            breed: {
              terms: { field: 'breed.keyword', size: 20 },
            },
            species: {
              terms: { field: 'species.keyword', size: 20 },
            },
          },
        },
      });

      const hits = response.hits;
      const total =
        typeof hits.total === 'object' ? hits.total.value : hits.total;
      const results = hits.hits.map((h: any) => ({
        ...h._source,
        relevanceScore: h._score,
      }));

      const aggs = response.aggregations ?? {};
      const facets: Record<string, FacetCount[]> = {
        breed: (aggs.breed?.buckets ?? []).map((b: any) => ({
          value: b.key,
          count: b.doc_count,
        })),
        species: (aggs.species?.buckets ?? []).map((b: any) => ({
          value: b.key,
          count: b.doc_count,
        })),
      };

      return {
        results,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        searchTime: Date.now() - start,
        facets,
      };
    } catch (err) {
      this.logger.error('Elasticsearch searchPets failed', err);
      throw err;
    }
  }

  async searchVets(dto: SearchQueryDto): Promise<SearchResult> {
    const start = Date.now();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const from = (page - 1) * limit;
    const hasGeo = dto.latitude !== undefined && dto.longitude !== undefined;
    const radius = dto.radius ?? 25;

    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    if (dto.query) {
      mustClauses.push({
        multi_match: {
          query: dto.query,
          fields: [
            'vetName^3',
            'clinicName^2',
            'specializations',
            'city',
            'state',
            'address',
          ],
        },
      });
    } else {
      mustClauses.push({ match_all: {} });
    }

    if (hasGeo) {
      filterClauses.push({
        geo_distance: {
          distance: `${radius}km`,
          location: {
            lat: dto.latitude,
            lon: dto.longitude,
          },
        },
      });
    }

    const sort: any[] = [];
    if (hasGeo) {
      sort.push({
        _geo_distance: {
          location: { lat: dto.latitude, lon: dto.longitude },
          order: 'asc',
          unit: 'km',
        },
      });
    } else {
      sort.push({ _score: { order: 'desc' } });
    }

    try {
      const response = await (this.client as any).search({
        index: 'vets',
        from,
        size: limit,
        body: {
          query: {
            bool: {
              must: mustClauses,
              filter: filterClauses,
            },
          },
          sort,
          aggs: {
            specializations: {
              terms: { field: 'specializations.keyword', size: 20 },
            },
          },
        },
      });

      const hits = response.hits;
      const total =
        typeof hits.total === 'object' ? hits.total.value : hits.total;
      const results = hits.hits.map((h: any) => {
        const sortValues = h.sort;
        const distance = hasGeo && sortValues ? sortValues[0] : undefined;
        return {
          ...h._source,
          relevanceScore: h._score,
          ...(distance !== undefined ? { distance } : {}),
        };
      });

      const aggs = response.aggregations ?? {};
      const facets: Record<string, FacetCount[]> = {
        specializations: (aggs.specializations?.buckets ?? []).map(
          (b: any) => ({
            value: b.key,
            count: b.doc_count,
          }),
        ),
      };

      return {
        results,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        searchTime: Date.now() - start,
        facets,
      };
    } catch (err) {
      this.logger.error('Elasticsearch searchVets failed', err);
      throw err;
    }
  }

  async searchMedicalRecords(dto: SearchQueryDto): Promise<SearchResult> {
    const start = Date.now();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const from = (page - 1) * limit;

    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    if (dto.query) {
      mustClauses.push({
        multi_match: {
          query: dto.query,
          fields: ['diagnosis^2', 'treatment^2', 'notes', 'recordType'],
        },
      });
    } else {
      mustClauses.push({ match_all: {} });
    }

    if (dto.condition) {
      filterClauses.push({ term: { 'diagnosis.keyword': dto.condition } });
    }

    if (dto.treatment) {
      filterClauses.push({ term: { 'treatment.keyword': dto.treatment } });
    }

    if (dto.recordType) {
      filterClauses.push({ term: { recordType: dto.recordType } });
    }

    if (dto.dateFrom || dto.dateTo) {
      const rangeFilter: any = {};
      if (dto.dateFrom) rangeFilter.gte = dto.dateFrom;
      if (dto.dateTo) rangeFilter.lte = dto.dateTo;
      filterClauses.push({ range: { visitDate: rangeFilter } });
    }

    try {
      const response = await (this.client as any).search({
        index: 'medical_records',
        from,
        size: limit,
        body: {
          query: {
            bool: {
              must: mustClauses,
              filter: filterClauses,
            },
          },
          aggs: {
            recordType: {
              terms: { field: 'recordType.keyword', size: 20 },
            },
          },
        },
      });

      const hits = response.hits;
      const total =
        typeof hits.total === 'object' ? hits.total.value : hits.total;
      const results = hits.hits.map((h: any) => ({
        ...h._source,
        relevanceScore: h._score,
      }));

      const aggs = response.aggregations ?? {};
      const facets: Record<string, FacetCount[]> = {
        recordType: (aggs.recordType?.buckets ?? []).map((b: any) => ({
          value: b.key,
          count: b.doc_count,
        })),
      };

      return {
        results,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        searchTime: Date.now() - start,
        facets,
      };
    } catch (err) {
      this.logger.error('Elasticsearch searchMedicalRecords failed', err);
      throw err;
    }
  }

  async autocomplete(query: string, type?: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const suggestions = new Set<string>();

    const indexFieldMap: Record<string, string[]> = {
      pets: ['name'],
      vets: ['vetName', 'clinicName'],
      'medical-records': ['diagnosis', 'treatment'],
    };

    const targetTypes =
      type && indexFieldMap[type] ? [type] : Object.keys(indexFieldMap);

    try {
      for (const t of targetTypes) {
        const fields = indexFieldMap[t];
        const shouldClauses = fields.map((f) => ({
          prefix: { [f]: { value: query } },
        }));

        const response = await (this.client as any).search({
          index: t === 'medical-records' ? 'medical_records' : t,
          size: 10,
          body: {
            query: {
              bool: { should: shouldClauses },
            },
            _source: fields,
          },
        });

        const hits = response.hits?.hits ?? [];
        for (const h of hits) {
          for (const f of fields) {
            const val = h._source?.[f];
            if (val && typeof val === 'string') {
              suggestions.add(val);
            }
          }
        }

        if (suggestions.size >= 10) break;
      }
    } catch (err) {
      this.logger.error('Elasticsearch autocomplete failed', err);
      throw err;
    }

    return Array.from(suggestions).slice(0, 10);
  }
}
