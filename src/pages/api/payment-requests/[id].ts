import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing request id' });
  }

  const token =
    req.headers.authorization ||
    (req.headers.cookie?.includes('authToken=')
      ? `Bearer ${req.headers.cookie.split('authToken=')[1]?.split(';')[0]}`
      : undefined);

  if (req.method === 'GET') {
    try {
      const upstream = await fetch(`${BACKEND}/payment-requests/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
      });

      if (upstream.ok) {
        const data = await upstream.json();
        return res.status(upstream.status).json(data);
      }
    } catch {
      // Backend unavailable
    }

    return res.status(404).json({ error: 'Payment request not found' });
  }

  res.setHeader('Allow', ['GET']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
