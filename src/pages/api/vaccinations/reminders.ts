import type { NextApiRequest, NextApiResponse } from 'next';
import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();
const CHANNELS = ['push', 'email', 'sms'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {};
  const { petId, vaccinationId, reminderDate, channel } = body as Record<string, unknown>;

  if (typeof petId !== 'string' || !petId) {
    return res.status(400).json({ error: 'petId is required' });
  }
  if (typeof vaccinationId !== 'string' || !vaccinationId) {
    return res.status(400).json({ error: 'vaccinationId is required' });
  }
  if (typeof reminderDate !== 'string' || Number.isNaN(Date.parse(reminderDate))) {
    return res.status(400).json({ error: 'reminderDate must be a valid date' });
  }
  if (typeof channel !== 'string' || !CHANNELS.includes(channel)) {
    return res.status(400).json({ error: 'channel must be one of push, email, sms' });
  }

  const payload = { petId, vaccinationId, reminderDate, channel };
  const authHeader = req.headers.authorization;

  try {
    const response = await fetch(`${API_BASE_URL}/vaccinations/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          (data as { message?: string; error?: string }).message ||
          (data as { message?: string; error?: string }).error ||
          'Failed to create vaccination reminder',
      });
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error('Vaccination reminder API error:', err);
    return res.status(500).json({ error: 'Failed to create vaccination reminder' });
  }
}
