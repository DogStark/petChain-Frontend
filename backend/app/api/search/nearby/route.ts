import esClient from "lib/elasticsearch";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const { lat, lon, distance = '20km' } = await request.json();

    if (!lat || !lon) {
        return NextResponse.json(
            { error: 'Latitude and longitude are required' },
            { status: 400 }
        );
    }

    const result = await esClient.search({
        index: 'pets',
        query: {
            bool: {
                filter: [
                    {
                        geo_distance: {
                            distance,
                            location: { lat, lon }
                        }
                    }
                ]
            }
        },
        sort: [
            {
                _geo_distance: {
                    location: { lat, lon },
                    order: 'asc'
                }
            }
        ]
    });

    return NextResponse.json(result.hits.hits);
}

