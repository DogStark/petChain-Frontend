import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const engagementData = [
    { date: 'Mon', activeUsers: 1200, newSignups: 45 },
    { date: 'Tue', activeUsers: 1350, newSignups: 52 },
    { date: 'Wed', activeUsers: 1100, newSignups: 38 },
    { date: 'Thu', activeUsers: 1420, newSignups: 65 },
    { date: 'Fri', activeUsers: 1580, newSignups: 72 },
    { date: 'Sat', activeUsers: 1800, newSignups: 95 },
    { date: 'Sun', activeUsers: 1950, newSignups: 110 },
  ];

  res.status(200).json(engagementData);
}
