import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const [health, alerts, performance] = await Promise.all([
      fetch(`${BACKEND}/api/v1/observability/health`)
        .then((r) => {
          if (!r.ok) throw new Error(`Status ${r.status}`);
          return r.json();
        })
        .catch((err) => ({ status: 'error', error: err.message })),
      fetch(`${BACKEND}/api/v1/observability/alerts`)
        .then((r) => {
          if (!r.ok) throw new Error(`Status ${r.status}`);
          return r.json();
        })
        .catch(() => []),
      fetch(`${BACKEND}/api/v1/observability/performance`)
        .then((r) => {
          if (!r.ok) throw new Error(`Status ${r.status}`);
          return r.json();
        })
        .catch((err) => ({ error: err.message })),
    ]);

    if (health.status === 'error') {
      return res.status(503).json({
        error: 'Health check failed',
        detail: health.error,
        health,
        alerts,
        performance,
      });
    }

    res.status(200).json({ health, alerts, performance });
  } catch (e) {
    res.status(503).json({ error: 'Backend unreachable', detail: (e as Error).message });
  }
}
