import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const [health, alerts, performance] = await Promise.all([
      fetch(`${BACKEND}/api/v1/observability/health`).then((r) => r.json()),
      fetch(`${BACKEND}/api/v1/observability/alerts`).then((r) => r.json()),
      fetch(`${BACKEND}/api/v1/observability/performance`).then((r) => r.json()),
    ]);
    res.status(200).json({ health, alerts, performance });
  } catch (e) {
    res.status(503).json({ error: 'Backend unreachable', detail: (e as Error).message });
  }
}
