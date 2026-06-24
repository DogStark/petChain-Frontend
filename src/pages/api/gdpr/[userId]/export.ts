import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query as { userId: string };

  if (!UUID_RE.test(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  if (req.method === 'GET') {
    const r = await fetch(`${BACKEND}/gdpr/users/${userId}/export`);
    const data = await r.json();
    res.setHeader('Content-Disposition', `attachment; filename="petchain-data-export.json"`);
    return res.status(r.status).json(data);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
