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

    const response = await fetch(`${BACKEND}/analytics/appointments/stats`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Analytics appointment stats error:', err);
    res.status(500).json({ error: 'Failed to fetch appointment stats' });
  }
}
