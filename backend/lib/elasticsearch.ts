import { Client, errors } from '@elastic/elasticsearch';
import { Logger } from '@nestjs/common';

const logger = new Logger('Elasticsearch');

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  ...(process.env.ELASTICSEARCH_API_KEY
    ? { auth: { apiKey: process.env.ELASTICSEARCH_API_KEY } }
    : {}),
  requestTimeout: parseInt(process.env.ELASTICSEARCH_TIMEOUT ?? '10000', 10),
  maxRetries: 3,
});

export default esClient;

// ---------------------------------------------------------------------------
// Index definitions
// ---------------------------------------------------------------------------

export const INDEX_PETS = 'pets';
export const INDEX_VETS = 'vets';
export const INDEX_MEDICAL_RECORDS = 'medical_records';

const INDEX_MAPPINGS: Record<string, object> = {
  [INDEX_PETS]: {
    mappings: {
      properties: {
        name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        species: { type: 'keyword' },
        breed: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        color: { type: 'keyword' },
        gender: { type: 'keyword' },
        dateOfBirth: { type: 'date' },
        microchipNumber: { type: 'keyword' },
        isActive: { type: 'boolean' },
        ownerId: { type: 'keyword' },
      },
    },
  },
  [INDEX_VETS]: {
    mappings: {
      properties: {
        vetName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        clinicName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        specializations: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        city: { type: 'keyword' },
        state: { type: 'keyword' },
        address: { type: 'text' },
        location: { type: 'geo_point' },
      },
    },
  },
  [INDEX_MEDICAL_RECORDS]: {
    mappings: {
      properties: {
        diagnosis: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        treatment: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        notes: { type: 'text' },
        recordType: { type: 'keyword' },
        visitDate: { type: 'date' },
        petId: { type: 'keyword' },
        vetId: { type: 'keyword' },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Index management
// ---------------------------------------------------------------------------

/** Create an index with its mapping if it does not already exist. */
export async function ensureIndex(index: string): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index });
    if (!exists) {
      await esClient.indices.create({
        index,
        body: INDEX_MAPPINGS[index] ?? {},
      });
      logger.log(`Index "${index}" created`);
    }
  } catch (err) {
    logger.error(`Failed to ensure index "${index}"`, err);
    throw err;
  }
}

/** Create all application indices. */
export async function ensureAllIndices(): Promise<void> {
  await Promise.all(
    [INDEX_PETS, INDEX_VETS, INDEX_MEDICAL_RECORDS].map(ensureIndex),
  );
}

/** Delete an index (use with caution). */
export async function deleteIndex(index: string): Promise<void> {
  try {
    await esClient.indices.delete({ index });
    logger.log(`Index "${index}" deleted`);
  } catch (err) {
    if (err instanceof errors.ResponseError && err.statusCode === 404) return;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Document operations
// ---------------------------------------------------------------------------

export interface IndexDocumentOptions {
  index: string;
  id: string;
  document: Record<string, unknown>;
}

/** Index (create or replace) a single document. */
export async function indexDocument(opts: IndexDocumentOptions): Promise<void> {
  try {
    await esClient.index({ index: opts.index, id: opts.id, document: opts.document });
  } catch (err) {
    logger.error(`Failed to index document ${opts.id} in "${opts.index}"`, err);
    throw err;
  }
}

/** Delete a document by id. */
export async function deleteDocument(index: string, id: string): Promise<void> {
  try {
    await esClient.delete({ index, id });
  } catch (err) {
    if (err instanceof errors.ResponseError && err.statusCode === 404) return;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Search utilities
// ---------------------------------------------------------------------------

export interface SearchOptions {
  index: string;
  query: object;
  from?: number;
  size?: number;
  sort?: object[];
  aggs?: object;
}

export interface SearchResponse<T = Record<string, unknown>> {
  results: T[];
  total: number;
  searchTime: number;
  aggregations?: Record<string, unknown>;
}

/** Execute a search and return typed results. */
export async function search<T = Record<string, unknown>>(
  opts: SearchOptions,
): Promise<SearchResponse<T>> {
  const start = Date.now();
  try {
    const response = await (esClient as any).search({
      index: opts.index,
      from: opts.from ?? 0,
      size: opts.size ?? 10,
      body: {
        query: opts.query,
        ...(opts.sort ? { sort: opts.sort } : {}),
        ...(opts.aggs ? { aggs: opts.aggs } : {}),
      },
    });

    const hits = response.hits;
    const total = typeof hits.total === 'object' ? hits.total.value : (hits.total ?? 0);
    const results: T[] = hits.hits.map((h: any) => ({
      ...h._source,
      _id: h._id,
      _score: h._score,
    }));

    return {
      results,
      total,
      searchTime: Date.now() - start,
      aggregations: response.aggregations,
    };
  } catch (err) {
    logger.error(`Search failed on index "${opts.index}"`, err);
    throw err;
  }
}

/** Build a standard bool query with must + filter clauses. */
export function buildBoolQuery(
  mustClauses: object[],
  filterClauses: object[],
): object {
  return {
    bool: {
      must: mustClauses.length ? mustClauses : [{ match_all: {} }],
      filter: filterClauses,
    },
  };
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/** Returns true if the Elasticsearch cluster is reachable. */
export async function isHealthy(): Promise<boolean> {
  try {
    await esClient.ping();
    return true;
  } catch {
    return false;
  }
}
