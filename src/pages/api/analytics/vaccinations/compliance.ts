import type { NextApiRequest, NextApiResponse } from 'next';
import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const query = new URLSearchParams();
    const { startDate, endDate, petId, fresh, groupBy } = req.query;

    if (startDate) query.set('startDate', String(startDate));
    if (endDate) query.set('endDate', String(endDate));
    if (petId) query.set('petId', String(petId));
    if (fresh) query.set('fresh', String(fresh));
    if (groupBy) query.set('groupBy', String(groupBy));

    const queryString = query.toString();
    const backendUrl = `${API_BASE_URL}/analytics/vaccinations/compliance${queryString ? `?${queryString}` : ''}`;
    const authHeader = req.headers.authorization;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          (data as { message?: string; error?: string }).message ||
          (data as { message?: string; error?: string }).error ||
          'Failed to fetch vaccination compliance',
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Vaccination compliance API error:', err);
    return res.status(500).json({ error: 'Failed to fetch vaccination compliance' });
  }
}
