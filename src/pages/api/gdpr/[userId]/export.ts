import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query as { userId: string };

  if (req.method === 'GET') {
    const r = await fetch(`${BACKEND}/gdpr/users/${userId}/export`);
    const data = await r.json();
    res.setHeader('Content-Disposition', `attachment; filename="petchain-data-${userId}.json"`);
    return res.status(r.status).json(data);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
