import { classifyRetry, ErrorShape } from '@/lib/api/retryClassifier';

// ── Helpers ─────────────────────────────────────────────────────────────────────

function networkError(): ErrorShape {
  return { message: 'Network Error', request: {} };
}

function serverError(status: number, headers?: Record<string, string | string[] | undefined>): ErrorShape {
  return { response: { status, headers } };
}

function retryAfterHeaderValue(value: string): ErrorShape {
  return serverError(429, { 'retry-after': value });
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('classifyRetry', () => {
  // ── Status matrix ─────────────────────────────────────────────────────────

  describe('status matrix', () => {
    // Non-retryable 4xx codes
    it.each([
      [400, 'Bad Request'],
      [401, 'Unauthorized'],
      [403, 'Forbidden'],
      [404, 'Not Found'],
      [405, 'Method Not Allowed'],
      [409, 'Conflict'],
      [410, 'Gone'],
      [413, 'Payload Too Large'],
      [415, 'Unsupported Media Type'],
      [422, 'Unprocessable Entity'],
      [431, 'Request Header Fields Too Large'],
    ])('returns shouldRetry=false for non-retryable status %i (%s)', (status) => {
      const result = classifyRetry(serverError(status));
      expect(result.shouldRetry).toBe(false);
      expect(result.retryAfterMs).toBeNull();
      expect(result.reason).toContain(String(status));
    });

    // Retryable server errors (5xx)
    it.each([
      [500, 'Internal Server Error'],
      [502, 'Bad Gateway'],
      [503, 'Service Unavailable'],
      [504, 'Gateway Timeout'],
    ])('returns shouldRetry=true for retryable status %i (%s)', (status) => {
      const result = classifyRetry(serverError(status), 'GET');
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBeNull();
      expect(result.reason).toContain(String(status));
    });

    // 429 rate-limit
    it('returns shouldRetry=true for 429 without Retry-After', () => {
      const result = classifyRetry(serverError(429));
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBeNull();
      expect(result.reason).toContain('Rate-limited');
    });

    it('returns shouldRetry=true for 429 with delta-seconds Retry-After', () => {
      const result = classifyRetry(retryAfterHeaderValue('5'));
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBe(5000);
    });

    it('returns shouldRetry=true for 429 with HTTP-date Retry-After', () => {
      // RFC 1123 date ~5 seconds from now
      const future = new Date(Date.now() + 3000);
      const dateStr = future.toUTCString();
      const result = classifyRetry(retryAfterHeaderValue(dateStr));
      expect(result.shouldRetry).toBe(true);
      // Should be within a small window around 3000ms
      expect(result.retryAfterMs).toBeGreaterThanOrEqual(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(10000);
    });

    it('caps Retry-After at MAX_RETRY_AFTER_MS', () => {
      // 1 hour in seconds = 3600 → 3600000ms, well over 300000ms cap
      const result = classifyRetry(retryAfterHeaderValue('3600'));
      expect(result.shouldRetry).toBe(true);
      // When capped, parseRetryAfter returns null so the caller uses default back-off
      expect(result.retryAfterMs).toBeNull();
    });

    it('handles 0 delta-seconds Retry-After', () => {
      const result = classifyRetry(retryAfterHeaderValue('0'));
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    // Unclassified status codes
    it.each([200, 201, 204, 301, 302, 304, 307, 308, 402, 406, 410, 418, 451, 511, 600])(
      'returns shouldRetry=false for unclassified status %i',
      (status) => {
        const result = classifyRetry(serverError(status));
        expect(result.shouldRetry).toBe(false);
        expect(result.retryAfterMs).toBeNull();
      },
    );
  });

  // ── Network / connectivity errors ────────────────────────────────────────

  describe('network errors', () => {
    it('returns shouldRetry=true for network error without response', () => {
      const result = classifyRetry(networkError(), 'GET');
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBeNull();
      expect(result.reason).toContain('Network error');
    });

    it('retries network errors for mutations too (server never saw the request)', () => {
      const result = classifyRetry(networkError(), 'POST', true);
      expect(result.shouldRetry).toBe(true);
    });

    it('retries network errors for mutations even without idempotency key (server never saw request)', () => {
      const result = classifyRetry(networkError(), 'POST', false);
      expect(result.shouldRetry).toBe(true);
    });

    it('returns shouldRetry=true when error has no response and no status', () => {
      const result = classifyRetry({ message: 'timeout of 10000ms exceeded' }, 'GET');
      expect(result.shouldRetry).toBe(true);
    });
  });

  // ── Mutation idempotency rules ────────────────────────────────────────────

  describe('mutation idempotency requirements', () => {
    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      'refuses retry for %s server error without idempotency key',
      (method) => {
        const result = classifyRetry(serverError(500), method);
        expect(result.shouldRetry).toBe(false);
        expect(result.reason).toContain('without idempotency key');
      },
    );

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      'allows retry for %s server error WITH idempotency key',
      (method) => {
        const result = classifyRetry(serverError(500), method, true);
        expect(result.shouldRetry).toBe(true);
        expect(result.retryAfterMs).toBeNull();
        expect(result.reason).toContain('Server error');
      },
    );

    // Read-only methods are not affected by the idempotency gate.
    it.each(['GET', 'HEAD', 'OPTIONS'])(
      'allows retry for %s server error regardless of idempotency key',
      (method) => {
        const result = classifyRetry(serverError(500), method, false);
        expect(result.shouldRetry).toBe(true);
      },
    );

    it('treats lowercase method names correctly', () => {
      const result = classifyRetry(serverError(500), 'post', false);
      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toContain('without idempotency key');

      const resultWithKey = classifyRetry(serverError(500), 'post', true);
      expect(resultWithKey.shouldRetry).toBe(true);
    });

    it('allows retry on 429 rate-limit for mutations without idempotency key', () => {
      // Rate-limit is a special case – the request was received and rejected
      // due to quota, not due to a server bug. Idempotency is still good
      // practice but the retry classifier does not block on it for 429.
      const result = classifyRetry(serverError(429), 'POST', false);
      expect(result.shouldRetry).toBe(true);
    });

    it('allows retry on 429 rate-limit for mutations with idempotency key', () => {
      const result = classifyRetry(serverError(429), 'POST', true);
      expect(result.shouldRetry).toBe(true);
    });
  });

  // ── Retry-After header parsing edge-cases ─────────────────────────────────

  describe('Retry-After header parsing', () => {
    it('returns null when header is absent', () => {
      const result = classifyRetry(serverError(429));
      expect(result.retryAfterMs).toBeNull();
    });

    it('parses RFC 850 date', () => {
      const future = new Date(Date.now() + 2000);
      // RFC 850: Sunday, 06-Nov-94 08:49:37 GMT
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = days[future.getUTCDay()];
      const date = future.getUTCDate().toString().padStart(2, '0');
      const month = months[future.getUTCMonth()];
      const year = future.getUTCFullYear();
      const hours = future.getUTCHours().toString().padStart(2, '0');
      const mins = future.getUTCMinutes().toString().padStart(2, '0');
      const secs = future.getUTCSeconds().toString().padStart(2, '0');
      const dateStr = `${day}, ${date}-${month}-${year} ${hours}:${mins}:${secs} GMT`;

      const result = classifyRetry(retryAfterHeaderValue(dateStr));
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBeGreaterThanOrEqual(0);
    });

    it('handles whitespace-padded header values', () => {
      const result = classifyRetry(serverError(429, { 'retry-after': '  2  ' }));
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBe(2000);
    });

    it('returns null for unparseable header values', () => {
      const result = classifyRetry(retryAfterHeaderValue('foo-bar'));
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBeNull();
    });

    it('returns null for empty string header value', () => {
      const result = classifyRetry(serverError(429, { 'retry-after': '' }));
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBeNull();
    });

    it('handles header with array value (axios duplicate header)', () => {
      const result = classifyRetry(
        serverError(429, { 'retry-after': ['3', '3'] }),
      );
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBe(3000);
    });

    it('handles negative delta-seconds gracefully', () => {
      const result = classifyRetry(retryAfterHeaderValue('-5'));
      expect(result.shouldRetry).toBe(true);
      // parseInt('-5') = -5, which is < 0 so parseRetryAfter returns null
      expect(result.retryAfterMs).toBeNull();
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles undefined method gracefully', () => {
      const result = classifyRetry(serverError(500));
      expect(result.shouldRetry).toBe(true);
    });

    it('handles null-ish error objects gracefully', () => {
      const result = classifyRetry({});
      expect(result.shouldRetry).toBe(false);
      expect(result.retryAfterMs).toBeNull();
    });

    it('returns shouldRetry=false when error has neither response nor request', () => {
      const result = classifyRetry({ message: 'Something went wrong' });
      expect(result.shouldRetry).toBe(false);
    });

    it('respects lowercase retry-after header key', () => {
      const result = classifyRetry(serverError(429, { 'retry-after': '10' }));
      expect(result.shouldRetry).toBe(true);
      expect(result.retryAfterMs).toBe(10000);
    });
  });
});