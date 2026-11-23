import {
  REDACTED,
  DebugHistory,
  createSnapshot,
  isSensitiveKey,
  redact,
} from './debug';

describe('debug redaction utilities', () => {
  describe('isSensitiveKey', () => {
    it('flags credential, wallet, contact, and medical keys', () => {
      expect(isSensitiveKey('accessToken')).toBe(true);
      expect(isSensitiveKey('walletAddress')).toBe(true);
      expect(isSensitiveKey('email')).toBe(true);
      expect(isSensitiveKey('medicalNotes')).toBe(true);
    });

    it('does not flag benign keys', () => {
      expect(isSensitiveKey('componentName')).toBe(false);
      expect(isSensitiveKey('count')).toBe(false);
    });
  });

  describe('redact', () => {
    it('redacts nested sensitive fields in objects and arrays', () => {
      const payload = {
        user: {
          name: 'Ada',
          email: 'ada@example.com',
          wallet: { address: '0xabc', balance: 10 },
        },
        records: [
          { id: 1, medicalNotes: 'private' },
          { id: 2, diagnosis: 'flu' },
        ],
        token: 'secret-token',
      };

      const result = redact(payload) as typeof payload;

      expect(result.user.name).toBe('Ada');
      expect(result.user.email).toBe(REDACTED);
      expect(result.user.wallet).toBe(REDACTED);
      expect(result.records[0].medicalNotes).toBe(REDACTED);
      expect(result.records[1].diagnosis).toBe(REDACTED);
      expect(result.token).toBe(REDACTED);
    });

    it('handles empty objects and arrays', () => {
      expect(redact({})).toEqual({});
      expect(redact([])).toEqual([]);
    });

    it('passes through primitives and null', () => {
      expect(redact('plain')).toBe('plain');
      expect(redact(42)).toBe(42);
      expect(redact(null)).toBe(null);
    });

    it('guards against circular references', () => {
      const circular: Record<string, unknown> = { name: 'loop' };
      circular.self = circular;
      const result = redact(circular) as Record<string, unknown>;
      expect(result.name).toBe('loop');
      expect(result.self).toBe(REDACTED);
    });
  });

  describe('createSnapshot', () => {
    it('applies allowlist and redacts retained fields', () => {
      const snapshot = createSnapshot(
        'test',
        { component: 'Board', token: 'abc', extra: 'drop' },
        ['component', 'token'],
      );
      expect(snapshot.label).toBe('test');
      expect(snapshot.data).toEqual({ component: 'Board', token: REDACTED });
    });

    it('keeps all fields when no allowlist is provided', () => {
      const snapshot = createSnapshot('test', { a: 1, b: 2 });
      expect(snapshot.data).toEqual({ a: 1, b: 2 });
    });
  });

  describe('DebugHistory', () => {
    it('enforces the maximum entry count', () => {
      const history = new DebugHistory(2);
      history.add(createSnapshot('a', {}));
      history.add(createSnapshot('b', {}));
      history.add(createSnapshot('c', {}));
      const labels = history.all().map((entry) => entry.label);
      expect(labels).toEqual(['b', 'c']);
    });

    it('drops entries older than the max age', () => {
      const history = new DebugHistory(10, 1000);
      const old = createSnapshot('old', {});
      old.timestamp = Date.now() - 5000;
      history.add(old);
      history.add(createSnapshot('fresh', {}));
      const labels = history.all().map((entry) => entry.label);
      expect(labels).toEqual(['fresh']);
    });

    it('clears all entries', () => {
      const history = new DebugHistory();
      history.add(createSnapshot('a', {}));
      history.clear();
      expect(history.all()).toEqual([]);
    });
  });
});
