import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Verifies the Bearer token in the request and checks that the user has the
 * 'admin' role.  Returns the verified user or writes the appropriate error
 * response (401 / 403) and returns null.
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

  const token = authHeader.slice(7);

  let user: { id: string; role: string };
  try {
    const response = await fetch(`${BACKEND}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    user = await response.json();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return user;
}
