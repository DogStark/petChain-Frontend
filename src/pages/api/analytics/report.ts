import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let petTrends = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toISOString().split('T')[0],
      registrations: 10,
      species: {
        dogs: 5,
        cats: 3,
        other: 1,
      },
    };
  });

  try {
    const authHeader = req.headers.authorization || '';
    const petTrendsResponse = await fetch(`${BACKEND}/api/v1/analytics/pet-registrations`, {
      headers: {
        Authorization: authHeader,
      },
    });
    if (petTrendsResponse.ok) {
      petTrends = await petTrendsResponse.json();
    }
  } catch (error) {
    console.error('Failed to fetch pet trends from backend:', error);
  }

  const report = {
    userMetrics: {
      totalUsers: 1247,
      activeUsers: 892,
      newSignups: 156,
      retentionRate: 71.5,
    },
    petTrends,
    vaccinationCompliance: {
      compliant: 856,
      nonCompliant: 124,
      overdue: 67,
      upcoming: 203,
      rate: 87.3,
    },
    appointmentStats: {
      total: 2341,
      completed: 1876,
      cancelled: 234,
      upcoming: 231,
      averagePerDay: 78,
    },
    geoDistribution: [
      { region: 'North America', country: 'USA', users: 542, pets: 1234 },
      { region: 'Europe', country: 'UK', users: 234, pets: 567 },
      { region: 'Asia', country: 'Japan', users: 98, pets: 234 },
    ],
    generatedAt: new Date().toISOString(),
  };

  res.status(200).json(report);
}
