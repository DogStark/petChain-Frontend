import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ISearchStrategy } from '../interfaces/search-strategy.interface';
import { SearchQueryDto } from '../dto/search-query.dto';
import {
  SearchResult,
  FacetCount,
} from '../interfaces/search-result.interface';

@Injectable()
export class PostgresSearchStrategy implements ISearchStrategy {
  constructor(private readonly dataSource: DataSource) {}

  private sanitizeQuery(raw: string): string {
    return raw
      .replace(/'/g, ' ')
      .replace(/;/g, ' ')
      .replace(/--/g, ' ')
      .replace(/\/\*/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(' & ');
  }

  async searchPets(dto: SearchQueryDto): Promise<SearchResult> {
    const start = Date.now();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const offset = (page - 1) * limit;

    const params: any[] = [];
    const conditions: string[] = [];
    let tsQuery = '';

    if (dto.query) {
      tsQuery = this.sanitizeQuery(dto.query);
      params.push(tsQuery);
      conditions.push(
        `p.search_vector @@ to_tsquery('english', $${params.length})`,
      );
    }

    if (!dto.includeInactive) {
      conditions.push(`p.is_active = true AND p.deleted_at IS NULL`);
    }

    if (dto.breed) {
      params.push(`%${dto.breed}%`);
      conditions.push(`b.name ILIKE $${params.length}`);
    }

    if (dto.species) {
      params.push(dto.species);
      conditions.push(`p.species = $${params.length}`);
    }

    if (dto.gender) {
      params.push(dto.gender);
      conditions.push(`p.gender = $${params.length}`);
    }

    if (dto.minAge !== undefined) {
      params.push(dto.minAge);
      conditions.push(
        `EXTRACT(YEAR FROM AGE(NOW(), p.date_of_birth)) >= $${params.length}`,
      );
    }

    if (dto.maxAge !== undefined) {
      params.push(dto.maxAge);
      conditions.push(
        `EXTRACT(YEAR FROM AGE(NOW(), p.date_of_birth)) <= $${params.length}`,
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    let relevanceSelect = '';
    if (tsQuery) {
      relevanceSelect = `, ts_rank(p.search_vector, to_tsquery('english', $1)) AS "relevanceScore"`;
    }

    let orderBy = 'ORDER BY p.created_at DESC';
    if (tsQuery && (!dto.sortBy || dto.sortBy === 'relevance')) {
      orderBy = `ORDER BY "relevanceScore" DESC`;
    } else if (dto.sortBy === 'name') {
      orderBy = `ORDER BY p.name ${dto.sortOrder ?? 'ASC'}`;
    } else if (dto.sortBy === 'createdAt') {
      orderBy = `ORDER BY p.created_at ${dto.sortOrder ?? 'DESC'}`;
    }

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const sql = `
      SELECT p.*, b.name AS "breedName"${relevanceSelect}
      FROM pets p
      LEFT JOIN breeds b ON b.id = p.breed_id
      ${whereClause}
      ${orderBy}
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM pets p
      LEFT JOIN breeds b ON b.id = p.breed_id
      ${whereClause}
    `;

    const countParams = params.slice(0, params.length - 2);
    const [rows, countRows] = await Promise.all([
      this.dataSource.query(sql, params),
      this.dataSource.query(countSql, countParams),
    ]);

    const total = parseInt(countRows[0]?.total ?? '0', 10);

    // Facets
    const facetConditions = conditions.filter(
      (c) => !c.includes('search_vector'),
    );
    const facetWhere = facetConditions.length
      ? `WHERE ${facetConditions.join(' AND ')}`
      : '';
    const facetParams = params.slice(tsQuery ? 1 : 0, params.length - 2);

    const breedFacetSql = `
      SELECT b.name AS value, COUNT(*) AS count
      FROM pets p
      LEFT JOIN breeds b ON b.id = p.breed_id
      ${facetWhere}
      GROUP BY b.name
      ORDER BY count DESC
    `;
    const speciesFacetSql = `
      SELECT p.species AS value, COUNT(*) AS count
      FROM pets p
      LEFT JOIN breeds b ON b.id = p.breed_id
      ${facetWhere}
      GROUP BY p.species
      ORDER BY count DESC
    `;

    const [breedFacets, speciesFacets] = await Promise.all([
      this.dataSource.query(breedFacetSql, facetParams),
      this.dataSource.query(speciesFacetSql, facetParams),
    ]);

    const facets: Record<string, FacetCount[]> = {
      breed: breedFacets.map((r: any) => ({
        value: r.value ?? 'Unknown',
        count: parseInt(r.count, 10),
      })),
      species: speciesFacets.map((r: any) => ({
        value: r.value,
        count: parseInt(r.count, 10),
      })),
    };

    return {
      results: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchTime: Date.now() - start,
      facets,
    };
  }

  async searchVets(dto: SearchQueryDto): Promise<SearchResult> {
    const start = Date.now();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const offset = (page - 1) * limit;

    const params: any[] = [];
    const conditions: string[] = [];
    let tsQuery = '';
    const hasGeo = dto.latitude !== undefined && dto.longitude !== undefined;
    const radius = dto.radius ?? 25;

    if (dto.query) {
      tsQuery = this.sanitizeQuery(dto.query);
      params.push(tsQuery);
      conditions.push(
        `v.search_vector @@ to_tsquery('english', $${params.length})`,
      );
    }

    if (dto.specialty) {
      params.push(`%${dto.specialty}%`);
      conditions.push(`v.specializations ILIKE $${params.length}`);
    }

    if (dto.location) {
      params.push(`%${dto.location}%`);
      conditions.push(
        `(v.city ILIKE $${params.length} OR v.state ILIKE $${params.length})`,
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    let relevanceSelect = '';
    if (tsQuery) {
      relevanceSelect = `, ts_rank(v.search_vector, to_tsquery('english', $1)) AS "relevanceScore"`;
    }

    let distanceSelect = '';
    let havingClause = '';
    let orderBy = 'ORDER BY v."createdAt" DESC';

    if (hasGeo) {
      params.push(dto.latitude);
      const latParam = `$${params.length}`;
      params.push(dto.longitude);
      const lngParam = `$${params.length}`;
      params.push(radius);
      const radiusParam = `$${params.length}`;

      distanceSelect = `,
        (6371 * acos(
          cos(radians(${latParam})) * cos(radians(v.latitude::float)) *
          cos(radians(v.longitude::float) - radians(${lngParam})) +
          sin(radians(${latParam})) * sin(radians(v.latitude::float))
        )) AS distance`;

      havingClause = `HAVING (6371 * acos(
          cos(radians(${latParam})) * cos(radians(v.latitude::float)) *
          cos(radians(v.longitude::float) - radians(${lngParam})) +
          sin(radians(${latParam})) * sin(radians(v.latitude::float))
        )) <= ${radiusParam}`;

      orderBy = `ORDER BY distance ASC`;
    } else if (tsQuery && (!dto.sortBy || dto.sortBy === 'relevance')) {
      orderBy = `ORDER BY "relevanceScore" DESC`;
    } else if (dto.sortBy === 'name') {
      orderBy = `ORDER BY v."vetName" ${dto.sortOrder ?? 'ASC'}`;
    } else if (dto.sortBy === 'createdAt') {
      orderBy = `ORDER BY v."createdAt" ${dto.sortOrder ?? 'DESC'}`;
    } else if (dto.sortBy === 'distance' && hasGeo) {
      orderBy = `ORDER BY distance ASC`;
    }

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const sql = `
      SELECT v.*${relevanceSelect}${distanceSelect}
      FROM vets v
      ${whereClause}
      ${havingClause ? `GROUP BY v.id ${havingClause}` : ''}
      ${orderBy}
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const countParams = params.slice(0, params.length - 2);
    const countSql = `
      SELECT COUNT(*) AS total
      FROM vets v
      ${whereClause}
    `;

    const [rows, countRows] = await Promise.all([
      this.dataSource.query(sql, params),
      this.dataSource.query(countSql, countParams),
    ]);

    const total = parseInt(countRows[0]?.total ?? '0', 10);

    // Facets for specializations (unnest simple-array stored as comma-separated)
    const facetConditions = conditions.filter(
      (c) => !c.includes('search_vector'),
    );
    const facetWhere = facetConditions.length
      ? `WHERE ${facetConditions.join(' AND ')}`
      : '';
    const facetParams = params.slice(
      tsQuery ? 1 : 0,
      params.length - (hasGeo ? 5 : 2),
    );

    const specFacetSql = `
      SELECT unnest(string_to_array(v.specializations, ',')) AS value, COUNT(*) AS count
      FROM vets v
      ${facetWhere}
      GROUP BY value
      ORDER BY count DESC
    `;

    const specFacets = await this.dataSource.query(specFacetSql, facetParams);

    const facets: Record<string, FacetCount[]> = {
      specializations: specFacets.map((r: any) => ({
        value: (r.value ?? '').trim(),
        count: parseInt(r.count, 10),
      })),
    };

    return {
      results: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchTime: Date.now() - start,
      facets,
    };
  }

  async searchMedicalRecords(dto: SearchQueryDto): Promise<SearchResult> {
    const start = Date.now();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const offset = (page - 1) * limit;

    const params: any[] = [];
    const conditions: string[] = [];
    let tsQuery = '';

    if (dto.query) {
      tsQuery = this.sanitizeQuery(dto.query);
      params.push(tsQuery);
      conditions.push(
        `mr.search_vector @@ to_tsquery('english', $${params.length})`,
      );
    }

    if (dto.condition) {
      params.push(`%${dto.condition}%`);
      conditions.push(`mr.diagnosis ILIKE $${params.length}`);
    }

    if (dto.treatment) {
      params.push(`%${dto.treatment}%`);
      conditions.push(`mr.treatment ILIKE $${params.length}`);
    }

    if (dto.recordType) {
      params.push(dto.recordType);
      conditions.push(`mr."recordType" = $${params.length}`);
    }

    if (dto.dateFrom) {
      params.push(dto.dateFrom);
      conditions.push(`mr.visit_date >= $${params.length}`);
    }

    if (dto.dateTo) {
      params.push(dto.dateTo);
      conditions.push(`mr.visit_date <= $${params.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    let relevanceSelect = '';
    if (tsQuery) {
      relevanceSelect = `, ts_rank(mr.search_vector, to_tsquery('english', $1)) AS "relevanceScore"`;
    }

    let orderBy = 'ORDER BY mr.visit_date DESC';
    if (dto.sortBy === 'visitDate') {
      orderBy = `ORDER BY mr.visit_date ${dto.sortOrder ?? 'DESC'}`;
    } else if (dto.sortBy === 'createdAt') {
      orderBy = `ORDER BY mr."createdAt" ${dto.sortOrder ?? 'DESC'}`;
    } else if (tsQuery && dto.sortBy === 'relevance') {
      orderBy = `ORDER BY "relevanceScore" DESC`;
    }

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const sql = `
      SELECT mr.*${relevanceSelect}
      FROM medical_records mr
      ${whereClause}
      ${orderBy}
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const countParams = params.slice(0, params.length - 2);
    const countSql = `
      SELECT COUNT(*) AS total
      FROM medical_records mr
      ${whereClause}
    `;

    const [rows, countRows] = await Promise.all([
      this.dataSource.query(sql, params),
      this.dataSource.query(countSql, countParams),
    ]);

    const total = parseInt(countRows[0]?.total ?? '0', 10);

    // Facets for record_type
    const facetConditions = conditions.filter(
      (c) => !c.includes('search_vector'),
    );
    const facetWhere = facetConditions.length
      ? `WHERE ${facetConditions.join(' AND ')}`
      : '';
    const facetParams = params.slice(tsQuery ? 1 : 0, params.length - 2);

    const rtFacetSql = `
      SELECT mr."recordType" AS value, COUNT(*) AS count
      FROM medical_records mr
      ${facetWhere}
      GROUP BY mr."recordType"
      ORDER BY count DESC
    `;

    const rtFacets = await this.dataSource.query(rtFacetSql, facetParams);

    const facets: Record<string, FacetCount[]> = {
      recordType: rtFacets.map((r: any) => ({
        value: r.value,
        count: parseInt(r.count, 10),
      })),
    };

    return {
      results: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchTime: Date.now() - start,
      facets,
    };
  }

  async autocomplete(query: string, type?: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const params: any[] = [query];
    const suggestions = new Set<string>();

    if (!type || type === 'pets') {
      const rows = await this.dataSource.query(
        `SELECT name FROM pets WHERE name ILIKE $1 || '%' AND is_active = true AND deleted_at IS NULL LIMIT 10`,
        params,
      );
      rows.forEach((r: any) => suggestions.add(r.name));
    }

    if (!type || type === 'vets') {
      const vetRows = await this.dataSource.query(
        `SELECT "vetName" AS name FROM vets WHERE "vetName" ILIKE $1 || '%' LIMIT 10`,
        params,
      );
      vetRows.forEach((r: any) => suggestions.add(r.name));

      const clinicRows = await this.dataSource.query(
        `SELECT "clinicName" AS name FROM vets WHERE "clinicName" ILIKE $1 || '%' LIMIT 10`,
        params,
      );
      clinicRows.forEach((r: any) => suggestions.add(r.name));
    }

    return Array.from(suggestions).slice(0, 10);
  }
}
