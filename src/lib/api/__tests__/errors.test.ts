import { describe, it, expect } from 'vitest';
import { parseApiError } from '../errors';

function makeResponse(
  body: BodyInit | null,
  init: ResponseInit & { contentType?: string } = {},
): Response {
  const headers = new Headers(init.headers);
  if (init.contentType) {
    headers.set('content-type', init.contentType);
  }
  return new Response(body, { ...init, headers });
}

describe('parseApiError', () => {
  it('parses JSON error bodies and preserves status and correlation metadata', async () => {
    const response = makeResponse(
      JSON.stringify({ message: 'Pet not found', code: 'NOT_FOUND' }),
      {
        status: 404,
        contentType: 'application/json',
        headers: { 'x-correlation-id': 'corr-123' },
      },
    );

    const error = await parseApiError(response);

    expect(error.status).toBe(404);
    expect(error.correlationId).toBe('corr-123');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Pet not found');
  });

  it('parses plain text error bodies', async () => {
    const response = makeResponse('Service unavailable', {
      status: 503,
      contentType: 'text/plain',
    });

    const error = await parseApiError(response);

    expect(error.status).toBe(503);
    expect(error.message).toBe('Service unavailable');
  });

  it('parses blob error bodies without leaking binary content', async () => {
    const response = makeResponse(new Blob(['binary-payload']), {
      status: 500,
      contentType: 'application/octet-stream',
    });

    const error = await parseApiError(response);

    expect(error.status).toBe(500);
    expect(error.message).not.toContain('binary-payload');
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('falls back to a safe message when the body is empty', async () => {
    const response = makeResponse(null, { status: 204 });

    const error = await parseApiError(response);

    expect(error.status).toBe(204);
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('never exposes raw server internals or stack traces to users', async () => {
    const response = makeResponse(
      JSON.stringify({
        message: 'Internal error',
        stack: 'Error: boom\n    at handler (/srv/app/index.js:42:13)',
        internal: { db: 'postgres://secret' },
      }),
      { status: 500, contentType: 'application/json' },
    );

    const error = await parseApiError(response);

    expect(error.message).toBe('Internal error');
    expect(error.message).not.toContain('at handler');
    expect(error.message).not.toContain('postgres://secret');
  });

  it('handles malformed JSON bodies without throwing', async () => {
    const response = makeResponse('{not valid json', {
      status: 400,
      contentType: 'application/json',
    });

    const error = await parseApiError(response);

    expect(error.status).toBe(400);
    expect(error.message.length).toBeGreaterThan(0);
  });
});
