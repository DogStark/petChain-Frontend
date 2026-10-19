import type { NextApiRequest, NextApiResponse } from 'next';

import {
  clearErrorDiagnostics,
  getErrorDiagnostics,
  containsSensitiveData,
  CORRELATION_HEADER,
} from '@/lib/errorCorrelation';

import handler from '../report';

type JsonBody = Record<string, unknown>;

function createRes() {
  const res: {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
    headers: Record<string, string>;
  } = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn((name: string, value: string) => {
      res.headers[name] = value;
    }),
    headers: {},
  };
  return res;
}

function createReq(body: JsonBody, method = 'POST'): NextApiRequest {
  return { method, body } as unknown as NextApiRequest;
}

beforeEach(() => {
  clearErrorDiagnostics();
});

describe('POST /api/errors/report', () => {
  it('accepts a clean report and echoes the correlation id', () => {
    const req = createReq({
      correlationId: 'ec-protected-lz3k9a-7fq2xh4m1b0d',
      routeGroup: 'protected',
      errorKind: 'TypeError',
    });
    const res = createRes();

    handler(req, res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(202);
    const payload = res.json.mock.calls[0][0] as { correlationId: string };
    expect(payload.correlationId).toBe('ec-protected-lz3k9a-7fq2xh4m1b0d');
    expect(res.headers[CORRELATION_HEADER]).toBe('ec-protected-lz3k9a-7fq2xh4m1b0d');
  });

  it('rejects a correlation id containing sensitive data (wallet key shape)', () => {
    const req = createReq({
      correlationId: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
      routeGroup: 'protected',
      errorKind: 'Error',
    });
    const res = createRes();

    handler(req, res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(400);
    // Nothing was stored.
    expect(getErrorDiagnostics()).toHaveLength(0);
  });

  it('rejects a correlation id that embeds a uuid (possible pet id)', () => {
    const req = createReq({
      correlationId: 'incident-123e4567-e89b-12d3-a456-426614174000',
      routeGroup: 'public',
      errorKind: 'Error',
    });
    const res = createRes();

    handler(req, res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('generates an id when none is supplied and stores a sanitized diagnostic', () => {
    const req = createReq({ routeGroup: 'public', errorKind: 'ChunkLoadError' });
    const res = createRes();

    handler(req, res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(202);
    const buffer = getErrorDiagnostics();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].routeGroup).toBe('public');
    expect(buffer[0].correlationId).toMatch(/^ec-public-/);
    expect(containsSensitiveData(buffer[0].correlationId)).toBe(false);
  });

  it('drops a free-form errorKind with suspicious content', () => {
    const req = createReq({
      correlationId: 'ec-public-ok-abc123def456',
      routeGroup: 'public',
      errorKind: 'Error: wallet seed phrase leaked <script>',
    });
    const res = createRes();

    handler(req, res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(getErrorDiagnostics()[0].errorKind).toBe('Error');
  });

  it('rejects non-POST requests with 405', () => {
    const req = createReq({}, 'GET');
    const res = createRes();

    handler(req, res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('treats a malformed JSON body as an anonymous report', () => {
    const req = { method: 'POST', body: '{not json' } as unknown as NextApiRequest;
    const res = createRes();

    handler(req, res as unknown as NextApiResponse);

    expect(res.status).toHaveBeenCalledWith(202);
    const payload = res.json.mock.calls[0][0] as { correlationId: string };
    expect(payload.correlationId).toMatch(/^ec-server-/);
  });
});
