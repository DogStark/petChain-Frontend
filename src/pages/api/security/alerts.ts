import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // TODO: Add proper authentication check
  // const session = await getServerSession(req, res, authOptions);
  // if (!session || session.user.role !== 'admin') {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // In a real implementation, this would call your backend API
    // For now, we'll simulate active alerts
    const mockAlerts = [
      {
        id: 'alert-1',
        type: 'threat',
        severity: 'HIGH',
        message: 'Multiple SQL injection attempts detected from IP 192.168.1.100',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
        acknowledged: false,
      },
      {
        id: 'alert-2',
        type: 'system',
        severity: 'MEDIUM',
        message: 'Rate limiting activated for suspicious traffic pattern',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 minutes ago
        acknowledged: false,
      },
      {
        id: 'alert-3',
        type: 'threat',
        severity: 'CRITICAL',
        message: 'DDoS attack pattern detected - automatic IP blocking activated',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        acknowledged: true,
      },
    ];

    res.status(200).json(mockAlerts);
  } catch (error) {
    console.error('Security alerts API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}