import esClient from 'lib/elasticsearch';
import { NextResponse } from 'next/server';

const DEFAULT_RADIUS_KM = parseFloat(process.env.SEARCH_RADIUS_DEFAULT ?? '20');
const MAX_RADIUS_KM = parseFloat(process.env.MAX_SEARCH_RADIUS ?? '200');
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const SUPPORTED_TYPES = ['clinic', 'vet', 'service'] as const;
type NearbyType = (typeof SUPPORTED_TYPES)[number];

const TYPE_INDEX_MAP: Record<NearbyType, string> = {
  clinic: 'vet_clinics',
  vet: 'vets',
  service: 'emergency_services',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const radiusParam = searchParams.get('radius');
  const type = (searchParams.get('type') ?? 'vet') as NearbyType;
  const limit = Math.min(
    parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

  // Validate required params
  if (!latParam || !lngParam) {
    return NextResponse.json(
      { error: 'Both "lat" and "lng" query parameters are required' },
      { status: 400 },
    );
  }

  const lat = parseFloat(latParam);
  const lng = parseFloat(lngParam);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return NextResponse.json(
      { error: 'Invalid latitude. Must be a number between -90 and 90' },
      { status: 400 },
    );
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: 'Invalid longitude. Must be a number between -180 and 180' },
      { status: 400 },
    );
  }

  const radius = radiusParam
    ? Math.min(parseFloat(radiusParam) || DEFAULT_RADIUS_KM, MAX_RADIUS_KM)
    : DEFAULT_RADIUS_KM;

  if (!SUPPORTED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${SUPPORTED_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const index = TYPE_INDEX_MAP[type];

  try {
    const response = await esClient.search({
      index,
      from: offset,
      size: limit,
      query: {
        bool: {
          filter: [
            {
              geo_distance: {
                distance: `${radius}km`,
                location: { lat, lon: lng },
              },
            },
          ],
        },
      },
      sort: [
        {
          _geo_distance: {
            location: { lat, lon: lng },
            order: 'asc',
            unit: 'km',
          },
        },
      ],
      fields: ['*'],
      _source: true,
    } as any);

    const hits = response.hits?.hits ?? [];
    const total =
      typeof response.hits?.total === 'object'
        ? response.hits.total.value
        : (response.hits?.total ?? 0);

    const results = hits.map((h: any) => ({
      id: h._id,
      distance: h.sort?.[0] ?? null,
      ...h._source,
    }));

    return NextResponse.json({
      lat,
      lng,
      radius,
      type,
      limit,
      offset,
      total,
      results,
    });
  } catch (err: any) {
    console.error('[search/nearby/route] error:', err);
    return NextResponse.json({ error: 'Search service unavailable' }, { status: 503 });
  }
}
