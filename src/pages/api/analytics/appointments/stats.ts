import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stats = {
    total: 2341,
    completed: 1876,
    cancelled: 234,
    upcoming: 231,
    averagePerDay: 78,
  };

  res.status(200).json(stats);
}
