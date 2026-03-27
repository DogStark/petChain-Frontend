# Requirements Document

## Introduction

This feature enhances the existing search module in the PetChain NestJS backend with a powerful, production-grade search and filtering engine. The system currently uses PostgreSQL ILIKE queries and has a basic Elasticsearch client configured. This feature will extend the existing `SearchModule` to support full-text search via PostgreSQL tsvector/tsquery (with optional Elasticsearch integration), advanced multi-field filtering, relevance-based ranking, geospatial veterinarian search, and search analytics tracking across three primary entities: Pets, Veterinarians, and Medical Records.

## Glossary

- **Search_Engine**: The NestJS `SearchModule` responsible for executing search queries across all entities.
- **Pet**: A registered animal in the system, stored in the `pets` table with fields such as name, species, breed, color, and microchip number.
- **Vet**: A veterinarian record in the `vets` table with fields such as clinic name, specializations, city, state, and license number.
- **Medical_Record**: A clinical record in the `medical_records` table linked to a Pet and optionally a Vet, containing diagnosis, treatment, record type, and notes.
- **Full_Text_Search**: Search using PostgreSQL `tsvector`/`tsquery` or Elasticsearch to match terms across multiple fields with ranking.
- **Relevance_Score**: A numeric score assigned to each search result indicating how closely it matches the query, used for ordering results.
- **Facet**: An aggregated count of distinct values for a filterable field (e.g., breed counts, specialty counts) returned alongside search results.
- **Geospatial_Search**: A search that filters Vets by proximity to a given latitude/longitude coordinate within a specified radius.
- **Search_Analytics**: Persisted records of each search query including type, filters applied, result count, response time, and success status.
- **Autocomplete**: A suggestion mechanism that returns partial-match terms from indexed fields as the user types.
- **Index**: A PostgreSQL GIN index on a `tsvector` column, or an Elasticsearch index, used to accelerate full-text search.
- **SearchQueryDto**: The NestJS DTO that carries all search parameters including query string, filters, pagination, and sort options.
- **SearchAnalytics_Entity**: The TypeORM entity `search_analytics` that persists each search event for analytics purposes.

---

## Requirements

### Requirement 1: Full-Text Search Across Pets

**User Story:** As a pet owner or administrator, I want to search for pets using natural language terms, so that I can quickly locate a pet by name, breed, species, color, or microchip number.

#### Acceptance Criteria

1. WHEN a search query is submitted to `GET /search/pets`, THE Search_Engine SHALL match the query against the `name`, `breed.name`, `species`, `color`, and `microchipNumber` fields of Pet records.
2. WHEN a search query contains multiple words, THE Search_Engine SHALL return results that match any of the words, ranked by the number of matching fields.
3. WHEN no query string is provided, THE Search_Engine SHALL return all active Pet records subject to any applied filters and pagination.
4. THE Search_Engine SHALL support fuzzy matching so that minor spelling variations in the query still return relevant Pet results.
5. WHEN a search query is submitted, THE Search_Engine SHALL return a `Relevance_Score` for each Pet result indicating match quality.

---

### Requirement 2: Full-Text Search Across Veterinarians

**User Story:** As a pet owner, I want to search for veterinarians by name, clinic, specialty, city, or state, so that I can find the right vet for my pet's needs.

#### Acceptance Criteria

1. WHEN a search query is submitted to `GET /search/vets`, THE Search_Engine SHALL match the query against the `vetName`, `clinicName`, `specializations`, `city`, `state`, and `address` fields of Vet records.
2. WHEN a `specialty` filter is provided, THE Search_Engine SHALL return only Vet records whose `specializations` array contains a value matching the filter term.
3. WHEN a `location` filter is provided, THE Search_Engine SHALL return only Vet records whose `city` or `state` field matches the filter value.
4. WHEN a search query is submitted, THE Search_Engine SHALL return a `Relevance_Score` for each Vet result.
5. THE Search_Engine SHALL support sorting Vet results by `name` (alphabetical) or `createdAt` (newest first).

---

### Requirement 3: Full-Text Search Across Medical Records

**User Story:** As a veterinarian or authorized user, I want to search medical records by diagnosis, treatment, record type, or notes, so that I can retrieve relevant clinical history efficiently.

#### Acceptance Criteria

1. WHEN a search query is submitted to `GET /search/medical-records`, THE Search_Engine SHALL match the query against the `diagnosis`, `treatment`, `notes`, and `recordType` fields of Medical_Record records.
2. WHEN a `condition` filter is provided, THE Search_Engine SHALL return only Medical_Record records whose `diagnosis` field matches the filter value.
3. WHEN a `treatment` filter is provided, THE Search_Engine SHALL return only Medical_Record records whose `treatment` field matches the filter value.
4. WHEN a `recordType` filter is provided, THE Search_Engine SHALL return only Medical_Record records whose `recordType` enum value matches the filter.
5. WHEN a `dateFrom` or `dateTo` filter is provided, THE Search_Engine SHALL return only Medical_Record records whose `visitDate` falls within the specified range.
6. THE Search_Engine SHALL sort Medical_Record results by `visitDate` descending by default.

---

### Requirement 4: Advanced Filtering

**User Story:** As a user, I want to apply multiple filters simultaneously to narrow search results, so that I can find exactly what I am looking for without sifting through irrelevant results.

#### Acceptance Criteria

1. THE Search_Engine SHALL support combining any number of filters in a single request using logical AND semantics.
2. WHEN a `minAge` and `maxAge` filter are provided for Pet search, THE Search_Engine SHALL return only Pet records whose `dateOfBirth` corresponds to an age within the specified range in years.
3. WHEN a `species` filter is provided for Pet search, THE Search_Engine SHALL return only Pet records whose `species` enum value matches the filter.
4. WHEN a `gender` filter is provided for Pet search, THE Search_Engine SHALL return only Pet records whose `gender` enum value matches the filter.
5. WHEN an `includeInactive` flag is set to `false` or omitted, THE Search_Engine SHALL exclude soft-deleted or inactive records from all search results.
6. WHEN an `includeInactive` flag is set to `true`, THE Search_Engine SHALL include inactive and soft-deleted records in search results.
7. THE Search_Engine SHALL return facet counts alongside search results for filterable fields (breed for pets, specializations for vets, recordType for medical records).

---

### Requirement 5: Sorting and Pagination

**User Story:** As a user, I want to sort and paginate search results, so that I can navigate large result sets in a predictable order.

#### Acceptance Criteria

1. THE Search_Engine SHALL support `page` and `limit` query parameters for all search endpoints, with a default of page 1 and limit 10.
2. THE `limit` parameter SHALL be constrained to a maximum value of 100 results per page.
3. WHEN a `sortBy` parameter is provided, THE Search_Engine SHALL order results by the specified field.
4. WHEN a `sortOrder` parameter of `ASC` or `DESC` is provided, THE Search_Engine SHALL apply the specified direction to the sort.
5. THE Search_Engine SHALL return `total`, `page`, `limit`, `totalPages`, and `searchTime` metadata fields in every search response.

---

### Requirement 6: Search Result Ranking and Relevance

**User Story:** As a user, I want search results ordered by relevance to my query, so that the most pertinent results appear first.

#### Acceptance Criteria

1. WHEN a query string is provided, THE Search_Engine SHALL rank results using a weighted scoring model where exact matches score higher than partial matches.
2. THE Search_Engine SHALL assign higher weight to matches in primary identifier fields (e.g., `name` for pets, `vetName` for vets) than to matches in secondary fields (e.g., `notes`, `color`).
3. WHEN `sortBy` is set to `relevance`, THE Search_Engine SHALL order results by descending `Relevance_Score`.
4. WHEN no `sortBy` is specified and a query string is present, THE Search_Engine SHALL default to relevance-based ordering.
5. THE Search_Engine SHALL include the `Relevance_Score` value in each result object when a query string is provided.

---

### Requirement 7: Geospatial Search for Veterinarians

**User Story:** As a pet owner, I want to find veterinarians near my location, so that I can choose a conveniently located clinic.

#### Acceptance Criteria

1. WHEN `latitude`, `longitude`, and `radius` parameters are provided to `GET /search/vets`, THE Search_Engine SHALL return only Vet records whose stored coordinates fall within the specified radius in kilometers.
2. WHEN geospatial parameters are provided, THE Search_Engine SHALL include a `distance` field in each Vet result indicating the distance in kilometers from the provided coordinates.
3. WHEN geospatial parameters are provided and `sortBy` is not explicitly set, THE Search_Engine SHALL sort Vet results by ascending `distance`.
4. IF `latitude` or `longitude` is provided without the other, THEN THE Search_Engine SHALL return a 400 Bad Request error with a descriptive message.
5. THE Vet entity SHALL store `latitude` and `longitude` as decimal columns to support geospatial queries.
6. WHEN `radius` is not provided alongside valid coordinates, THE Search_Engine SHALL apply a default radius of 25 kilometers.

---

### Requirement 8: Global Search

**User Story:** As a user, I want to search across all entity types simultaneously, so that I can find any relevant record with a single query.

#### Acceptance Criteria

1. WHEN a query is submitted to `GET /search/global`, THE Search_Engine SHALL execute concurrent searches across Pets, Vets, and Medical_Records and return grouped results.
2. THE Search_Engine SHALL limit each entity group in a global search response to a maximum of 5 results by default.
3. THE Search_Engine SHALL include the total count for each entity group in the global search response.
4. THE Search_Engine SHALL return the combined `searchTime` for the global search operation.

---

### Requirement 9: Autocomplete Suggestions

**User Story:** As a user, I want to see search suggestions as I type, so that I can quickly find what I am looking for without typing the full query.

#### Acceptance Criteria

1. WHEN a partial query of 2 or more characters is submitted to `GET /search/autocomplete`, THE Search_Engine SHALL return up to 10 matching suggestions from indexed field values.
2. WHEN a `type` parameter is provided to the autocomplete endpoint, THE Search_Engine SHALL restrict suggestions to fields belonging to the specified entity type.
3. WHEN the partial query is fewer than 2 characters, THE Search_Engine SHALL return an empty suggestions array and the current popular queries list.
4. THE Search_Engine SHALL deduplicate autocomplete suggestions before returning them.

---

### Requirement 10: Search Analytics Tracking

**User Story:** As an administrator, I want every search event to be recorded, so that I can analyze usage patterns and optimize the search experience.

#### Acceptance Criteria

1. WHEN any search endpoint is called, THE Search_Engine SHALL persist a Search_Analytics record containing the query string, search type, applied filters, result count, response time, and success status.
2. IF persisting a Search_Analytics record fails, THEN THE Search_Engine SHALL log the error and continue returning the search response without interruption.
3. WHEN `GET /search/analytics` is called with a `days` parameter, THE Search_Engine SHALL return aggregated analytics for the specified number of past days including total searches, success rate, average response time, and searches by type.
4. WHEN `GET /search/popular` is called, THE Search_Engine SHALL return the top 10 most frequently searched successful queries with their counts and last searched timestamps.
5. THE Search_Engine SHALL index the `query` and `createdAt` columns of the `search_analytics` table to ensure analytics queries execute within 500ms for datasets up to 1 million records.

---

### Requirement 11: Search Indexing

**User Story:** As a developer, I want searchable fields to be indexed in the database, so that search queries execute efficiently at scale.

#### Acceptance Criteria

1. THE Search_Engine SHALL use PostgreSQL GIN indexes on `tsvector` columns for full-text search on the `pets`, `vets`, and `medical_records` tables.
2. WHEN a Pet, Vet, or Medical_Record record is created or updated, THE Search_Engine SHALL update the corresponding search index entry within the same transaction.
3. THE Search_Engine SHALL expose a `POST /search/reindex` endpoint that triggers a full reindex of all searchable entities.
4. WHEN the reindex operation is triggered, THE Search_Engine SHALL process records in batches of 100 to avoid memory exhaustion.
5. IF the Elasticsearch environment variable `ELASTICSEARCH_URL` is configured, THE Search_Engine SHALL use Elasticsearch for full-text search; otherwise THE Search_Engine SHALL fall back to PostgreSQL full-text search.

---

### Requirement 12: Search API Security and Validation

**User Story:** As a developer, I want all search inputs to be validated and sanitized, so that the system is protected against injection attacks and malformed requests.

#### Acceptance Criteria

1. THE Search_Engine SHALL validate all query parameters using NestJS class-validator decorators before executing any database query.
2. WHEN a query string exceeds 500 characters, THE Search_Engine SHALL return a 400 Bad Request error.
3. WHEN numeric filter parameters (e.g., `latitude`, `longitude`, `radius`, `minAge`, `maxAge`) are outside their valid ranges, THE Search_Engine SHALL return a 400 Bad Request error with field-level error details.
4. THE Search_Engine SHALL sanitize query strings to remove SQL special characters before constructing parameterized queries.
5. WHEN the `limit` parameter exceeds 100, THE Search_Engine SHALL cap the value at 100 without returning an error.
