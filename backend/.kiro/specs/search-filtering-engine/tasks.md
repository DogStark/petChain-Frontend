# Implementation Plan: Search & Filtering Engine

## Overview

Upgrade the existing `SearchModule` from basic ILIKE queries to a production-grade full-text search engine using PostgreSQL tsvector/tsquery with GIN indexes as the primary strategy, optional Elasticsearch as an env-gated alternative, geospatial vet search, facets, autocomplete, analytics, and a reindex endpoint. The existing controller/service/DTO/entity files are extended rather than replaced.

## Tasks

- [x] 1. Database migration — add tsvector columns, GIN indexes, and lat/lng on vets
  - Create a TypeORM migration file `src/migrations/<timestamp>-AddSearchVectorColumns.ts`
  - Add `search_vector` GENERATED ALWAYS AS STORED tsvector column to `pets` (weighted: name A, species B, color C, microchip_id C)
  - Add `search_vector` GENERATED ALWAYS AS STORED tsvector column to `vets` (weighted: vet_name A, clinic_name A, city B, state B, address C)
  - Add `search_vector` GENERATED ALWAYS AS STORED tsvector column to `medical_records` (weighted: diagnosis A, treatment A, notes B, record_type C)
  - Add `latitude DECIMAL(9,6)` and `longitude DECIMAL(9,6)` nullable columns to `vets`
  - Create GIN indexes: `idx_pets_search_vector`, `idx_vets_search_vector`, `idx_medical_records_search_vector`
  - Backfill existing rows with a no-op UPDATE to trigger generated column population
  - Implement `down()` to drop all added columns and indexes
  - _Requirements: 11.1, 7.5_

- [x] 2. Entity updates — Vet lat/lng columns and search_vector awareness
  - [x] 2.1 Add `latitude` and `longitude` TypeORM `@Column` decorators to the `Vet` entity
    - Use `{ type: 'decimal', precision: 9, scale: 6, nullable: true }` for both
    - Do NOT map `search_vector` — it is a GENERATED ALWAYS AS column managed by PostgreSQL
    - _Requirements: 7.5_

  - [ ]* 2.2 Write unit tests for Vet entity column definitions
    - Verify `latitude` and `longitude` are present and nullable
    - _Requirements: 7.5_

- [x] 3. Extend SearchQueryDto with all new fields and validators
  - Replace the existing `src/modules/search/dto/search-query.dto.ts` with the extended version from the design
  - Add `@Type(() => Number)` decorators for numeric query-string coercion (page, limit, minAge, maxAge, latitude, longitude, radius)
  - Add `@IsEnum(PetSpecies)` for `species`, `@IsEnum(PetGender)` for `gender`, `@IsEnum(RecordType)` for `recordType`
  - Add `@IsDateString()` for `dateFrom` and `dateTo`
  - Add `@MaxLength(500)` to `query`
  - Add `@IsIn(['relevance','name','createdAt','visitDate','distance'])` to `sortBy`
  - Add `@Transform` boolean coercion for `includeInactive`
  - Keep existing fields (`type`, `serviceType`, `is24Hours`, `tags`) for backward compatibility
  - _Requirements: 12.1, 12.2, 12.3, 12.5, 4.2, 4.3, 4.4, 3.4, 3.5_

  - [ ]* 3.1 Write unit tests for SearchQueryDto validation
    - Test `query` > 500 chars → validation error
    - Test `limit` > 100 → capped at 100 (transform: true)
    - Test `latitude` without `longitude` passes DTO (guard is in service layer)
    - Test enum fields reject invalid values
    - Test `@Type(() => Number)` coerces string "5" to number 5
    - Test `includeInactive` coerces string "true" to boolean true
    - _Requirements: 12.1, 12.2, 12.3, 12.5_

- [x] 4. Extend SearchResult interface and add FacetCount type
  - Update `src/modules/search/interfaces/search-result.interface.ts`
  - Add `relevanceScore?: number` and `distance?: number` to the result item type
  - Add `facets?: Record<string, FacetCount[]>` to `SearchResult`
  - Export `FacetCount` interface `{ value: string; count: number }`
  - _Requirements: 6.5, 7.2, 4.7_

- [x] 5. Create ISearchStrategy interface and SearchStrategyFactory
  - Create `src/modules/search/interfaces/search-strategy.interface.ts` with `ISearchStrategy`:
    - `searchPets(dto: SearchQueryDto): Promise<SearchResult>`
    - `searchVets(dto: SearchQueryDto): Promise<SearchResult>`
    - `searchMedicalRecords(dto: SearchQueryDto): Promise<SearchResult>`
    - `autocomplete(query: string, type?: string): Promise<string[]>`
  - Create `src/modules/search/search-strategy.factory.ts` with `SearchStrategyFactory`:
    - Inject `ConfigService`, `PostgresSearchStrategy`, and optionally `ElasticsearchSearchStrategy`
    - `getStrategy(): ISearchStrategy` — returns Elasticsearch strategy if `ELASTICSEARCH_URL` is set, otherwise Postgres
    - Log which strategy is active at startup
  - _Requirements: 11.5_

- [x] 6. Implement PostgresSearchStrategy — full-text search, filtering, relevance, geospatial, facets, autocomplete
  - Create `src/modules/search/strategies/postgres-search.strategy.ts`
  - Implement `ISearchStrategy`
  - **searchPets**: use `to_tsquery('english', :tsQuery)` against `pet.search_vector`; join breed for breed-name tsvector; apply `ts_rank` as `relevanceScore`; apply filters (breed, minAge/maxAge via dateOfBirth, species, gender, includeInactive); return facets for breed and species via COUNT GROUP BY; default sort by relevance when query present, else `createdAt DESC`
  - **searchVets**: use `to_tsquery` against `vet.search_vector`; apply specialty and location filters; apply geospatial Haversine filter when lat/lng provided; default radius 25km; add `distance` field to each result; sort by distance when geo params present; return facets for specializations
  - **searchMedicalRecords**: use `to_tsquery` against `medical_record.search_vector`; apply condition, treatment, recordType, dateFrom/dateTo filters; default sort `visitDate DESC`; return facets for recordType
  - **autocomplete**: query `ts_stat` or ILIKE prefix match on indexed fields; deduplicate; return max 10; return empty array for query < 2 chars
  - Sanitize query string: strip SQL special characters via `xss` + regex before building tsquery
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.6, 9.1, 9.2, 9.3, 9.4, 12.4_

  - [ ]* 6.1 Write property test — Property 1: full-text search returns only matching records
    - **Property 1: Full-text search returns only matching records**
    - **Validates: Requirements 1.1, 2.1, 3.1**
    - Use `fc.string({ minLength: 2, maxLength: 50 })` as query; assert every result contains the term in at least one indexed field

  - [ ]* 6.2 Write property test — Property 2: empty query returns all active records
    - **Property 2: Empty query returns all active records**
    - **Validates: Requirements 1.3, 4.5**
    - Mock repository to return a fixed count; assert `total` equals active record count when `query` is undefined

  - [ ]* 6.3 Write property test — Property 3: inactive records excluded by default
    - **Property 3: Inactive records excluded by default**
    - **Validates: Requirements 4.5**
    - Assert no result has `isActive = false` or non-null `deletedAt` when `includeInactive` is false/absent

  - [ ]* 6.4 Write property test — Property 4: inactive records included when flag is set
    - **Property 4: Inactive records included when flag is set**
    - **Validates: Requirements 4.6**
    - Assert `total` with `includeInactive: true` >= `total` with `includeInactive: false` for same query

  - [ ]* 6.5 Write property test — Property 7: geospatial distance bound
    - **Property 7: Geospatial distance bound**
    - **Validates: Requirements 7.1, 7.2**
    - Use `fc.float` for lat/lng/radius; assert every result's `distance` <= radius

  - [ ]* 6.6 Write property test — Property 8: geospatial default radius
    - **Property 8: Geospatial default radius**
    - **Validates: Requirements 7.6**
    - Assert results with no radius equal results with `radius = 25`

  - [ ]* 6.7 Write property test — Property 9: relevance score ordering
    - **Property 9: Relevance score ordering**
    - **Validates: Requirements 6.3, 6.4**
    - Use `fc.string` query; assert `result[i].relevanceScore >= result[i+1].relevanceScore` for all consecutive pairs

  - [ ]* 6.8 Write property test — Property 16: age filter correctness
    - **Property 16: Age filter correctness**
    - **Validates: Requirements 4.2**
    - Use `fc.integer({ min: 0, max: 20 })` for minAge/maxAge; assert every result's `dateOfBirth` corresponds to age within [minAge, maxAge]

  - [ ]* 6.9 Write property test — Property 17: facet counts are consistent
    - **Property 17: Facet counts are consistent**
    - **Validates: Requirements 4.7**
    - Assert sum of all facet counts for any field <= `total`

  - [ ]* 6.10 Write unit tests for PostgresSearchStrategy
    - Mock `Repository` and `DataSource`; test query builder construction for each method
    - Test sanitization strips `'`, `;`, `--`, `/**/` from query strings
    - Test geospatial filter is applied only when both lat and lng are present
    - _Requirements: 12.4, 7.4_

- [x] 7. Checkpoint — ensure migration, entities, DTO, strategy, and Postgres strategy compile and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement ElasticsearchSearchStrategy (env-gated)
  - Create `src/modules/search/strategies/elasticsearch-search.strategy.ts`
  - Implement `ISearchStrategy` using the existing `@elastic/elasticsearch` client
  - **searchPets**: `multi_match` on `name^3`, `species^2`, `breed`, `color`, `microchipNumber`; apply bool filters for breed, species, gender, age range, isActive; return `_score` as `relevanceScore`; return breed/species aggregations as facets
  - **searchVets**: `multi_match` on `vetName^3`, `clinicName^2`, `specializations`, `city`, `state`, `address`; apply geo_distance filter when lat/lng provided; return `_score` as `relevanceScore` and computed distance
  - **searchMedicalRecords**: `multi_match` on `diagnosis^2`, `treatment^2`, `notes`, `recordType`; apply term/range filters; return `_score` as `relevanceScore`
  - **autocomplete**: use `search_as_you_type` field mapping or prefix query; deduplicate; return max 10
  - Wrap all ES calls in try/catch; on connection error log and throw so `SearchStrategyFactory` can fall back
  - _Requirements: 11.5_

  - [ ]* 8.1 Write unit tests for ElasticsearchSearchStrategy
    - Mock `@elastic/elasticsearch` Client; test query construction for each method
    - Test error propagation so factory can detect unavailability
    - _Requirements: 11.5_

- [x] 9. Implement SearchAnalyticsService
  - Create `src/modules/search/search-analytics.service.ts`
  - Extract and enhance the existing `trackSearch` private method from `SearchService` into this dedicated service
  - Implement `track(event: SearchEvent): Promise<void>` — fire-and-forget; catch all errors, log via NestJS `Logger`, never rethrow
  - Implement `getAnalytics(days: number): Promise<AnalyticsSummary>` — return `totalSearches`, `successfulSearches`, `successRate`, `avgResponseTime`, `searchesByType`
  - Implement `getPopularQueries(limit: number): Promise<PopularQuery[]>` — top N successful non-empty queries with count and lastSearched
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 9.1 Write property test — Property 10: analytics persistence
    - **Property 10: Analytics persistence**
    - **Validates: Requirements 10.1**
    - After any successful search call, assert a `SearchAnalytics` record exists with matching `searchType`, `query`, and `resultsCount`

  - [ ]* 9.2 Write property test — Property 11: analytics failure does not break search
    - **Property 11: Analytics failure does not break search**
    - **Validates: Requirements 10.2**
    - Mock `SearchAnalyticsService.track` to throw; assert search response is still 2xx with valid results

  - [ ]* 9.3 Write unit tests for SearchAnalyticsService
    - Test `track` swallows errors and logs them
    - Test `getAnalytics` computes `successRate` correctly for edge case of 0 total searches
    - Test `getPopularQueries` excludes empty-string queries
    - _Requirements: 10.2, 10.3, 10.4_

- [x] 10. Implement IndexingService
  - Create `src/modules/search/indexing.service.ts`
  - Implement `indexPet(petId: string)` — run `UPDATE pets SET name = name WHERE id = :id` to trigger GENERATED column refresh; also sync to Elasticsearch if strategy is ES
  - Implement `indexVet(vetId: string)` — same pattern for vets
  - Implement `indexMedicalRecord(recordId: string)` — same pattern for medical_records
  - Implement `reindexAll(): Promise<ReindexResult>` — use `QueryRunner`; process each entity in batches of 100; rollback current batch on error; return `{ indexed, failed, duration }`
  - Skip missing entities with a warning log rather than aborting the batch
  - _Requirements: 11.2, 11.3, 11.4_

  - [ ]* 10.1 Write property test — Property 18: reindex idempotency
    - **Property 18: Reindex idempotency**
    - **Validates: Requirements 11.3**
    - Call `reindexAll()` twice; assert the resulting indexed document set is identical both times

  - [ ]* 10.2 Write unit tests for IndexingService
    - Mock `QueryRunner`; test batch size is exactly 100
    - Test transaction rollback is called on batch failure
    - Test missing entity is skipped (warning logged, batch continues)
    - _Requirements: 11.3, 11.4_

- [x] 11. Refactor SearchService to use strategy delegation and SearchAnalyticsService
  - Update `src/modules/search/search.service.ts`
  - Inject `SearchStrategyFactory`, `SearchAnalyticsService`, and `IndexingService`
  - Replace ILIKE query builder logic in `searchPets`, `searchVets`, `searchMedicalRecords` with delegation to `this.strategyFactory.getStrategy().searchPets(dto)` etc.
  - Add lat/lng pair validation guard in `searchVets`: throw `BadRequestException` if exactly one of lat/lng is provided
  - Replace inline `trackSearch` calls with fire-and-forget `this.analyticsService.track(...).catch(() => {})` after each search
  - Keep `searchEmergencyServices` and `globalSearch` (update global to use strategy for the three main entities)
  - Keep `getPopularQueries` and `getSearchAnalytics` delegating to `SearchAnalyticsService`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 7.4, 10.1, 10.2_

  - [ ]* 11.1 Write property test — Property 5: pagination invariant
    - **Property 5: Pagination invariant**
    - **Validates: Requirements 5.1, 5.2, 5.5**
    - Use `fc.integer({ min: 1, max: 50 })` for page and `fc.integer({ min: 1, max: 100 })` for limit; assert `results.length <= limit` and `totalPages === Math.ceil(total / limit)`

  - [ ]* 11.2 Write property test — Property 6: limit cap enforcement
    - **Property 6: Limit cap enforcement**
    - **Validates: Requirements 5.2, 12.5**
    - Use `fc.integer({ min: 101, max: 1000 })` for limit; assert `results.length <= 100`

  - [ ]* 11.3 Write unit tests for SearchService
    - Test `searchVets` throws `BadRequestException` when only `latitude` is provided
    - Test `searchVets` throws `BadRequestException` when only `longitude` is provided
    - Test analytics is called fire-and-forget (does not await)
    - Test `globalSearch` limits each entity group to 5 results
    - _Requirements: 7.4, 8.2, 10.1_

- [x] 12. Checkpoint — ensure SearchService, SearchAnalyticsService, IndexingService compile and all unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Extend SearchController with new routes, ValidationPipe, and guards
  - Update `src/modules/search/search.controller.ts`
  - Add `@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))` at controller level
  - Add `POST /search/reindex` route delegating to `IndexingService.reindexAll()`; protect with `@UseGuards(JwtAuthGuard)`
  - Ensure `GET /search/analytics` and `GET /search/popular` pass typed query params (`days: number`, `limit: number`) to service
  - Ensure all existing routes (`/pets`, `/vets`, `/medical-records`, `/global`, `/autocomplete`, `/popular`, `/analytics`) use the updated `SearchQueryDto`
  - _Requirements: 5.1, 9.1, 9.2, 10.3, 10.4, 11.3_

  - [ ]* 13.1 Write property test — Property 12: autocomplete minimum length
    - **Property 12: Autocomplete minimum length**
    - **Validates: Requirements 9.3**
    - Use `fc.string({ maxLength: 1 })` as query; assert returned `suggestions` array is empty

  - [ ]* 13.2 Write property test — Property 13: autocomplete deduplication
    - **Property 13: Autocomplete deduplication**
    - **Validates: Requirements 9.4**
    - Assert `suggestions` array has no duplicate values for any valid query

  - [ ]* 13.3 Write property test — Property 14: query length validation
    - **Property 14: Query length validation**
    - **Validates: Requirements 12.2**
    - Use `fc.string({ minLength: 501, maxLength: 600 })` as query; assert HTTP response is 400

  - [ ]* 13.4 Write property test — Property 15: coordinate pair validation
    - **Property 15: Coordinate pair validation**
    - **Validates: Requirements 7.4**
    - Use `fc.float` for latitude only (no longitude); assert HTTP response is 400

  - [ ]* 13.5 Write unit tests for SearchController
    - Test each route delegates to the correct service method
    - Test `POST /search/reindex` returns 401 without JWT
    - Test `ValidationPipe` rejects query > 500 chars with 400
    - _Requirements: 12.1, 12.2, 11.3_

- [x] 14. Wire SearchModule — register all new providers and optional Elasticsearch module
  - Update `src/modules/search/search.module.ts`
  - Add `SearchAnalyticsService`, `IndexingService`, `SearchStrategyFactory`, `PostgresSearchStrategy`, `ElasticsearchSearchStrategy` to `providers`
  - Register `ElasticsearchModule.registerAsync` conditionally using `ConfigModule` — only instantiate when `ELASTICSEARCH_URL` is set
  - Export `SearchAnalyticsService` and `IndexingService` for use by other modules (e.g., PetsModule lifecycle hooks)
  - _Requirements: 11.5_

- [~] 15. Final checkpoint — full test suite passes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All property-based tests use `fast-check` (`npm install --save-dev fast-check`) with `{ numRuns: 100 }`
- Tag format for property tests: `// Feature: search-filtering-engine, Property N: <property_text>`
- The existing `searchEmergencyServices` method is preserved unchanged; only the three primary entities (pets, vets, medical-records) are upgraded to full-text search
- `search_vector` columns are GENERATED ALWAYS AS STORED — never map them in TypeORM entities
- The `xss` package is already in `dependencies`; use it alongside a regex strip for SQL special characters
