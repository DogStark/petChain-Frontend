import esClient from 'lib/elasticsearch';
import { NextResponse } from 'next/server';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SEARCHABLE_INDICES = ['pets', 'vets', 'medical_records'] as const;
type SearchableType = (typeof SEARCHABLE_INDICES)[number] | 'all';

const INDEX_FIELDS: Record<string, string[]> = {
  pets: ['name^3', 'breed^2', 'description', 'species', 'color'],
  vets: ['vetName^3', 'clinicName^2', 'specializations', 'city', 'state'],
  medical_records: ['diagnosis^2', 'treatment^2', 'notes', 'recordType'],
};

function sanitize(input: string): string {
  return input.replace(/[<>"'`;\\]/g, '').trim().slice(0, 500);
}

function parseSort(sort: string | null): Record<string, any>[] {
  if (sort === 'recent') return [{ createdAt: { order: 'desc' } }];
  return [{ _score: { order: 'desc' } }];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const rawQuery = searchParams.get('q') ?? '';
  const type = (searchParams.get('type') ?? 'all') as SearchableType;
  const limit = Math.min(
    parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);
  const sort = searchParams.get('sort');

  if (!rawQuery) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const query = sanitize(rawQuery);
  if (!query) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  const indices =
    type === 'all'
      ? SEARCHABLE_INDICES
      : SEARCHABLE_INDICES.filter((i) => i === type || i === `${type}s`);

  if (indices.length === 0) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: pet, vet, record, or omit for all` },
      { status: 400 },
    );
  }

  try {
    const searches = indices.flatMap((index) => [
      { index },
      {
        from: offset,
        size: limit,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: INDEX_FIELDS[index],
                  fuzziness: 'AUTO',
                  type: 'best_fields',
                },
              },
            ],
          },
        },
        sort: parseSort(sort),
        highlight: {
          fields: Object.fromEntries(
            INDEX_FIELDS[index].map((f) => [f.replace(/\^\d+$/, ''), {}]),
          ),
        },
      },
    ]);

    const msearchResponse = await esClient.msearch({ searches });

    const results: Record<string, any> = {};
    let totalHits = 0;

    msearchResponse.responses.forEach((res: any, i: number) => {
      const index = indices[i];
      if ('error' in res) {
        results[index] = { hits: [], total: 0, error: res.error.reason };
        return;
      }
      const hits = res.hits?.hits ?? [];
      const total = typeof res.hits?.total === 'object' ? res.hits.total.value : (res.hits?.total ?? 0);
      totalHits += total;
      results[index] = {
        hits: hits.map((h: any) => ({
          id: h._id,
          score: h._score,
          ...h._source,
          highlights: h.highlight ?? {},
        })),
        total,
      };
    });

    return NextResponse.json({
      query,
      type,
      limit,
      offset,
      totalHits,
      results,
    });
  } catch (err: any) {
    console.error('[search/route] error:', err);
    return NextResponse.json({ error: 'Search service unavailable' }, { status: 503 });
  }
}
