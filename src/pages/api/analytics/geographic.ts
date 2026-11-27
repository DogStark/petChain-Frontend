import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    // Forward only the date-range params the dashboard map supports.
    const query = new URLSearchParams();
    for (const key of ['startDate', 'endDate'] as const) {
      const value = req.query[key];
      if (typeof value === 'string' && value) {
        query.set(key, value);
      }
    }
    const queryString = query.toString();

    const response = await fetch(
      `${BACKEND}/analytics/geographic${queryString ? `?${queryString}` : ''}`,
      {
        method: 'GET',
        headers,
      },
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Analytics geographic error:', err);
    res.status(500).json({ error: 'Failed to fetch geographic data' });
  }
}
