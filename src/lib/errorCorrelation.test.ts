import {
  generateCorrelationId,
  redactCorrelationId,
  containsSensitiveData,
  attachCorrelationHeader,
  recordErrorDiagnostic,
  getErrorDiagnostics,
  clearErrorDiagnostics,
  CORRELATION_HEADER,
} from './errorCorrelation';

describe('errorCorrelation', () => {
  beforeEach(() => {
    clearErrorDiagnostics();
  });

  describe('generateCorrelationId', () => {
    it('embeds the route group and never sensitive terms', () => {
      for (const group of ['public', 'protected', 'server'] as const) {
        const id = generateCorrelationId(group);
        expect(id).toMatch(new RegExp(`^ec-${group}-[a-z0-9]+-[a-z0-9]{12}$`));
        expect(containsSensitiveData(id)).toBe(false);
      }
    });

    it('produces unique ids across many calls', () => {
      const ids = new Set(Array.from({ length: 200 }, () => generateCorrelationId()));
      expect(ids.size).toBe(200);
    });
  });

  describe('containsSensitiveData', () => {
    it.each([
      ['stellar secret key', 'SHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345'],
      ['stellar public key', 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW'],
      ['uuid (pet id)', '123e4567-e89b-12d3-a456-426614174000'],
      ['email', 'owner@example.com'],
      ['pet term', 'my-pet-123'],
      ['health term', 'vaccination-schedule'],
      ['wallet term', 'wallet-balance'],
      ['medical term', 'medical-record-42'],
    ])('flags %s', (_label, candidate) => {
      expect(containsSensitiveData(candidate)).toBe(true);
    });

    it.each([
      ['generated id', generateCorrelationId('protected')],
      ['plain token', 'ec-public-lz3k9a-7fq2xh4m1b0d'],
    ])('allows %s', (_label, candidate) => {
      expect(containsSensitiveData(candidate)).toBe(false);
    });
  });

  describe('redactCorrelationId', () => {
    it('keeps a safe caller-supplied id', () => {
      expect(redactCorrelationId('ec-public-ok-abc123def456')).toBe('ec-public-ok-abc123def456');
    });

    it('replaces a tainted id with a generated safe one', () => {
      const tainted = 'pet-123-vaccination';
      const safe = redactCorrelationId(tainted, 'public');
      expect(safe).not.toBe(tainted);
      expect(containsSensitiveData(safe)).toBe(false);
    });

    it('generates a fresh id for missing values', () => {
      expect(redactCorrelationId(undefined)).toMatch(/^ec-server-/);
      expect(redactCorrelationId(null, 'public')).toMatch(/^ec-public-/);
    });
  });

  describe('attachCorrelationHeader', () => {
    it('stamps the correlation header on empty headers', () => {
      const headers = attachCorrelationHeader(undefined, 'protected');
      expect(headers[CORRELATION_HEADER]).toMatch(/^ec-protected-/);
    });

    it('preserves existing headers while stamping', () => {
      const headers = attachCorrelationHeader({ Authorization: 'Bearer x' }, 'server');
      expect(headers.Authorization).toBe('Bearer x');
      expect(headers[CORRELATION_HEADER]).toMatch(/^ec-server-/);
    });

    it('respects a pre-existing correlation id (any casing)', () => {
      const lower = attachCorrelationHeader({ 'x-correlation-id': 'ec-public-ok-abc123def456' });
      expect(lower[CORRELATION_HEADER]).toBe('ec-public-ok-abc123def456');

      const upper = attachCorrelationHeader({ 'X-Correlation-Id': 'ec-public-ok-abc123def456' });
      expect(upper[CORRELATION_HEADER]).toBe('ec-public-ok-abc123def456');
    });

    it('replaces a tainted pre-existing id', () => {
      const headers = attachCorrelationHeader({ 'X-Correlation-Id': 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW' });
      expect(headers[CORRELATION_HEADER]).toMatch(/^ec-server-/);
    });
  });

  describe('diagnostics buffer', () => {
    it('records sanitized diagnostics with a monotonic sequence', () => {
      const a = recordErrorDiagnostic({
        correlationId: 'ec-public-ok-abc123def456',
        routeGroup: 'public',
        errorKind: 'TypeError',
        timestamp: new Date().toISOString(),
      });
      const b = recordErrorDiagnostic({
        correlationId: 'pet-vaccination-record',
        routeGroup: 'protected',
        errorKind: 'ApiError',
        timestamp: new Date().toISOString(),
      });

      expect(a.sequence).toBe(1);
      expect(b.sequence).toBe(2);
      // Tainted id was re-redacted on record:
      expect(b.correlationId).toMatch(/^ec-protected-/);

      const buffer = getErrorDiagnostics();
      expect(buffer).toHaveLength(2);
      expect(buffer[1].errorKind).toBe('ApiError');
    });

    it('caps the buffer size', () => {
      for (let i = 0; i < 40; i++) {
        recordErrorDiagnostic({
          correlationId: generateCorrelationId(),
          routeGroup: 'server',
          errorKind: 'Error',
          timestamp: new Date().toISOString(),
        });
      }
      expect(getErrorDiagnostics().length).toBeLessThanOrEqual(25);
    });
  });
});
