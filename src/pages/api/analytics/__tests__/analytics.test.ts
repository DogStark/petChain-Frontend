import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

import handler from '../index';
import { getServerSession } from 'next-auth/next';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

const mockedGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

const fetchMock = jest.fn();

global.fetch = fetchMock as unknown as typeof fetch;

function mockSession(role: string | null) {
  if (role === null) {
    mockedGetServerSession.mockResolvedValue(null);
    return;
  }
  mockedGetServerSession.mockResolvedValue({
    user: { id: 'user-1', email: 'user@example.com', role },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as never);
}

describe('analytics proxy API route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    process.env.ANALYTICS_API_URL = 'https://analytics.internal';
  });

  it('rejects unauthenticated requests with 401 and does not proxy', async () => {
    mockSession(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { range: '7d' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects cross-role requests with 403 and does not proxy', async () => {
    mockSession('user');
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { range: '7d' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    mockSession('admin');
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      query: { range: '7d' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid query parameters with 400 before proxying', async () => {
    mockSession('admin');
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { range: 'not-a-valid-range' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies authorized requests and forwards identity from the session, not client headers', async () => {
    mockSession('admin');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ total: 42 }),
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { range: '7d' },
      headers: {
        'x-user-id': 'spoofed-user',
        'x-user-role': 'admin',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ total: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('range=7d');
    const forwardedHeaders = (init as RequestInit).headers as Record<
      string,
      string
    >;
    expect(forwardedHeaders['x-user-id']).toBe('user-1');
    expect(forwardedHeaders['x-user-role']).toBe('admin');
  });

  it('returns 502 when the upstream analytics backend fails', async () => {
    mockSession('admin');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { range: '7d' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(502);
  });

  it('returns an empty result set when the backend has no data', async () => {
    mockSession('admin');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      query: { range: '30d' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ data: [] });
  });
});
