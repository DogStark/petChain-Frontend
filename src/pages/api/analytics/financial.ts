import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const financialData = [
    { month: 'Jan', revenue: 45000, expenses: 28000, profit: 17000 },
    { month: 'Feb', revenue: 52000, expenses: 31000, profit: 21000 },
    { month: 'Mar', revenue: 48000, expenses: 29000, profit: 19000 },
    { month: 'Apr', revenue: 61000, expenses: 34000, profit: 27000 },
    { month: 'May', revenue: 59000, expenses: 33000, profit: 26000 },
    { month: 'Jun', revenue: 75000, expenses: 40000, profit: 35000 },
  ];

  res.status(200).json(financialData);
}
