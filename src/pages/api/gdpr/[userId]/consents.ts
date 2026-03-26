import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query as { userId: string };

  if (req.method === 'GET') {
    const r = await fetch(`${BACKEND}/gdpr/users/${userId}/consents`);
    return res.status(r.status).json(await r.json());
  }
  if (req.method === 'PATCH') {
    const r = await fetch(`${BACKEND}/gdpr/users/${userId}/consents`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    return res.status(r.status).json(await r.json());
  }
  if (req.method === 'POST') {
    // init defaults
    const r = await fetch(`${BACKEND}/gdpr/users/${userId}/consents/init`, { method: 'POST' });
    return res.status(r.status).json(await r.json());
  }

  res.status(405).json({ error: 'Method not allowed' });
}
