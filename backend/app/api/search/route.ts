import esClient from 'lib/elasticsearch';
import { NextResponse } from 'next/server';


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const breed = searchParams.get('breed');

    const result = await esClient.search({
        index: 'pets',
        query: {
            bool: {
                must: [
                    {
                        multi_match: {
                            query: query ?? '',
                            fields: ['name^3', 'description', 'breed^2'],
                            fuzziness: 'AUTO'
                        }
                    }
                ],
                filter: breed
                    ? [{ term: { 'breed.keyword': breed } }]
                    : []
            }
        },
        aggs: {
            breed_facets: {
                terms: { field: 'breed.keyword' }
            }
        }
    });

    return NextResponse.json(result.hits.hits);
}