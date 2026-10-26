import type { NextApiRequest, NextApiResponse } from 'next';
import { isSafePublicAddress, isValidPaymentAmount } from '@/utils/paymentRequest';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Extract authorization token if present
  const token =
    req.headers.authorization ||
    (req.headers.cookie?.includes('authToken=')
      ? `Bearer ${req.headers.cookie.split('authToken=')[1]?.split(';')[0]}`
      : undefined);

  if (req.method === 'POST') {
    const { asset, amount, destination, expiresInMinutes, memo, memoType, note } = req.body || {};

    // Validate request input
    if (!destination || !isSafePublicAddress(destination)) {
      return res.status(400).json({ error: 'Invalid or unsafe destination address.' });
    }
    if (!amount || !isValidPaymentAmount(amount)) {
      return res.status(400).json({ error: 'Invalid payment amount.' });
    }
    if (!expiresInMinutes || Number(expiresInMinutes) <= 0) {
      return res.status(400).json({ error: 'expiresInMinutes must be greater than zero.' });
    }

    try {
      const upstream = await fetch(`${BACKEND}/payment-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify(req.body),
      });

      if (upstream.ok) {
        const data = await upstream.json();
        return res.status(upstream.status).json(data);
      }
    } catch {
      // Backend unavailable; forward to client fallback projection
    }

    // Default server projection if backend microservice is offline
    const now = Date.now();
    const expiresAt = new Date(now + Number(expiresInMinutes) * 60 * 1000).toISOString();
    const id = `req_${Math.random().toString(36).substring(2, 11)}_${now}`;

    return res.status(201).json({
      id,
      asset: String(asset || 'XLM').toUpperCase(),
      amount: String(amount),
      destination: String(destination).trim(),
      memo: memo ? String(memo) : undefined,
      memoType: memoType ? String(memoType) : undefined,
      note: note ? String(note) : undefined,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      status: 'active',
    });
  }

  res.setHeader('Allow', ['POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
