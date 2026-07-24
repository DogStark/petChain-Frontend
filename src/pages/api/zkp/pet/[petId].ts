import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { petId } = req.query as { petId: string };

  if (!UUID_RE.test(petId)) {
    return res.status(400).json({ error: 'Invalid petId' });
  }

  if (req.method === 'GET') {
    const token = req.headers.authorization || `Bearer ${req.headers.cookie?.split('authToken=')[1]?.split(';')[0]}`;

    const upstream = await fetch(`${BACKEND}/zkp/pet/${petId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: token } : {}),
      },
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
