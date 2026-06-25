import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const healthData = [
    { name: 'Healthy', value: 350, color: '#10b981' },
    { name: 'Sick', value: 45, color: '#f59e0b' },
    { name: 'Critical', value: 12, color: '#ef4444' },
  ];

  res.status(200).json(healthData);
}
