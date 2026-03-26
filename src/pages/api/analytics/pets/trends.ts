import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const trends = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString().split('T')[0],
      registrations: Math.floor(Math.random() * 50) + 10,
      species: {
        dogs: Math.floor(Math.random() * 30) + 5,
        cats: Math.floor(Math.random() * 20) + 3,
        other: Math.floor(Math.random() * 5) + 1,
      },
    };
  });

  res.status(200).json(trends);
}
