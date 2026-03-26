import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { startDate, endDate } = req.query;

  const metrics = {
    totalUsers: 1247,
    activeUsers: 892,
    newSignups: 156,
    retentionRate: 71.5,
  };

  res.status(200).json(metrics);
}
