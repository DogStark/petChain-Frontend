import type { NextApiRequest, NextApiResponse } from 'next';

import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';
import handler from '@/pages/api/analytics/export/personal-data-access';

function createMockRes() {
  const res: Partial<NextApiResponse> & {
    statusCode?: number;
    body?: unknown;
    headers: Record<string, unknown>;
  } = { headers: {} };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res as NextApiResponse;
  });
  res.json = jest.fn((data: unknown) => {
    res.body = data;
    return res as NextApiResponse;
  });
  res.setHeader = jest.fn((name: string, value: unknown) => {
    res.headers[name] = value;
    return res as NextApiResponse;
  });
  return res as NextApiResponse & { statusCode?: number; body?: unknown; headers: unknown };
}

function createReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'GET',
    headers: {},
    query: {},
    ...overrides,
  } as unknown as NextApiRequest;
}

describe('analytics export personal-data access route', () => {
  const originalFetch = global.fetch;
  const originalDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_API_URL = 'http://backend.test/api/v1';
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalDemoMode === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = originalDemoMode;
    if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  it('rejects non-GET methods', async () => {
    const res = createMockRes();
    await handler(createReq({ method: 'POST' }), res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(['GET']);
  });

  it('rejects malformed and reversed date ranges', async () => {
    const malformed = createMockRes();
    await handler(createReq({ query: { startDate: 'not-a-date' } }), malformed);
    expect(malformed.statusCode).toBe(400);
    expect(malformed.body).toMatchObject({ allowed: false, reason: 'invalid_range' });

    const reversed = createMockRes();
    await handler(
      createReq({ query: { startDate: '2026-10-26', endDate: '2026-10-24' } }),
      reversed,
    );
    expect(reversed.statusCode).toBe(400);
    expect(reversed.body).toMatchObject({ allowed: false, reason: 'invalid_range' });
  });

  it('refuses consent scopes longer than twelve months', async () => {
    const res = createMockRes();
    await handler(
      createReq({
        query: { startDate: '2024-01-01', endDate: '2025-01-02' },
        headers: { authorization: 'Bearer token' },
      }),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ allowed: false, reason: 'scope_exceeded' });
  });

  it('grants access in server-side demo mode without trusting the client', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    global.fetch = jest.fn();
    const res = createMockRes();

    await handler(createReq({ query: { startDate: '2026-10-24', endDate: '2026-10-26' } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ allowed: true, reason: 'demo_mode' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('requires an authenticated session when demo mode is off', async () => {
    const res = createMockRes();
    await handler(createReq(), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ allowed: false, reason: 'authentication_required' });
  });

  it('forwards the backend decision for an authenticated request', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ allowed: true, reason: 'consent_granted' }),
    });

    const res = createMockRes();
    await handler(
      createReq({
        headers: { authorization: 'Bearer token', cookie: 'authToken=cookie-token' },
        query: { startDate: '2026-10-24', endDate: '2026-10-26' },
      }),
      res,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      `${getApiBaseUrl()}/analytics/export/personal-data-access?startDate=2026-10-24&endDate=2026-10-26`,
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer token' },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ allowed: true, reason: 'consent_granted' });
  });

  it('propagates a backend consent denial', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ reason: 'consent_not_granted' }),
    });

    const res = createMockRes();
    await handler(createReq({ headers: { authorization: 'Bearer token' } }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ allowed: false, reason: 'consent_not_granted' });
  });

  it('fails closed when the backend answers with an error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const res = createMockRes();
    await handler(createReq({ headers: { authorization: 'Bearer token' } }), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ allowed: false, reason: 'authorization_unavailable' });
  });

  it('fails closed when the backend is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('connection refused'));

    const res = createMockRes();
    await handler(createReq({ headers: { authorization: 'Bearer token' } }), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ allowed: false, reason: 'authorization_unavailable' });
  });
});
