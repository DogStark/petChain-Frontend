import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Verifies the Bearer token in the request and checks that the user has the
 * 'admin' role.  Returns the verified user or writes the appropriate error
 * response (401 / 403) and returns null.
 *
 * Authorization is enforced server-side from the token itself; any client
 * supplied role/state (headers, body, query) is ignored so forged client
 * state cannot grant admin access.
 */
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ id: string; role: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  let user: { id: string; role: string };
  try {
    const response = await fetch(`${BACKEND}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401 || response.status === 403) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    if (!response.ok) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    user = await response.json();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  if (!user || typeof user.id !== 'string' || user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return user;
}
