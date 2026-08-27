import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'crypto';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface JwtPayload {
  sub?: string;
  id?: string;
  userId?: string;
  role?: string;
}

/**
 * Best-effort decode of the bearer token's payload to identify the caller
 * for an access check on this proxy route. This does NOT verify the token's
 * signature (the frontend has no access to the auth signing secret) — the
 * backend remains the source of truth for authorization. This is
 * defense-in-depth only, and the raw token is still forwarded to the
 * backend so it can perform real verification.
 */
function decodeBearerPayload(authHeader: string | undefined): JwtPayload | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function auditLog(entry: Record<string, unknown>) {
  // Structured audit line for GDPR export access. In production this should
  // be shipped to a durable audit sink rather than stdout only.
  console.info('[gdpr-export-audit]', JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query as { userId: string };
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? null;

  if (!UUID_RE.test(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    auditLog({ userId, ip, outcome: 'denied', reason: 'missing_auth' });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = decodeBearerPayload(authHeader);
  const actorId = payload?.sub ?? payload?.id ?? payload?.userId ?? null;
  const isAdmin = payload?.role === 'admin';
  if (!payload || !actorId || (actorId !== userId && !isAdmin)) {
    auditLog({ userId, actorId, ip, outcome: 'denied', reason: 'forbidden' });
    return res.status(403).json({ error: 'Forbidden' });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/gdpr/users/${userId}/export`, {
      headers: { Authorization: authHeader },
    });
  } catch {
    auditLog({ userId, actorId, ip, outcome: 'error', reason: 'upstream_unreachable' });
    return res.status(502).json({ error: 'Export service unavailable' });
  }

  if (!upstream.ok) {
    auditLog({ userId, actorId, ip, outcome: 'error', reason: `upstream_${upstream.status}` });
    const body = await upstream.text();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(upstream.status).send(body);
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  const checksum = createHash('sha256').update(buffer).digest('hex');

  // Never cache or persist a personal-data export; force immediate expiry
  // and prevent intermediaries from storing/serving it again.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="petchain-data-export-${userId}.json"`);
  // Integrity check for the downloaded payload.
  res.setHeader('X-Content-SHA256', checksum);
  res.setHeader('ETag', `"${checksum}"`);

  auditLog({ userId, actorId, ip, outcome: 'success', bytes: buffer.length, checksum });

  return res.status(200).send(buffer);
}
