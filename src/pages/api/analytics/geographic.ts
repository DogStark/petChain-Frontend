import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const distribution = [
    { region: 'North America', country: 'USA', users: 542, pets: 1234 },
    { region: 'North America', country: 'Canada', users: 187, pets: 423 },
    { region: 'Europe', country: 'UK', users: 234, pets: 567 },
    { region: 'Europe', country: 'Germany', users: 156, pets: 389 },
    { region: 'Asia', country: 'Japan', users: 98, pets: 234 },
    { region: 'Asia', country: 'Singapore', users: 67, pets: 156 },
  ];

  res.status(200).json(distribution);
}
