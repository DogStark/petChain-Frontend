import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const compliance = {
    compliant: 856,
    nonCompliant: 124,
    overdue: 67,
    upcoming: 203,
    rate: 87.3,
  };

  res.status(200).json(compliance);
}
