import type { NextApiRequest, NextApiResponse } from 'next';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Twilio status callback webhook.
 * Forwards to backend for delivery status updates and cost tracking.
 * Configure Twilio Message statusCallback to this URL, or point directly to backend: {API_BASE_URL}/sms/webhook/status
 */
export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-twilio-signature'] as string | undefined;
  const body = req.body as Record<string, string>;

  try {
    const backendUrl = `${API_BASE_URL.replace(/\/$/, '')}/sms/webhook/status`;
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature && { 'X-Twilio-Signature': signature }),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Twilio webhook forward error:', err);
    res.status(500).json({ success: false, error: 'Webhook forward failed' });
  }
}
