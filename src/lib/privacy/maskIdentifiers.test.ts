import { maskEmail, maskIdentifier, maskText, maskValue } from '@/lib/privacy/maskIdentifiers';

describe('maskIdentifiers', () => {
  describe('maskEmail', () => {
    it('keeps the first character of each part and hides the rest', () => {
      expect(maskEmail('jane@example.com')).toBe('j•••@e•••.com');
      expect(maskEmail('a@b.c')).toBe('a•••@b•••.c');
    });

    it('handles addresses without a dot in the domain', () => {
      expect(maskEmail('jane@localhost')).toBe('j•••@l•••');
    });

    it('falls back to identifier masking when the value is not an email', () => {
      expect(maskEmail('usr_8f2a9b31')).toBe('usr_••••9b31');
    });

    it('returns an empty string for empty input', () => {
      expect(maskEmail('')).toBe('');
      expect(maskEmail(null)).toBe('');
      expect(maskEmail(undefined)).toBe('');
      expect(maskEmail({})).toBe('');
    });

    it('is idempotent so re-rendering never reveals more', () => {
      const once = maskEmail('jane@example.com');
      expect(maskEmail(once)).toBe(once);
    });
  });

  describe('maskIdentifier', () => {
    it('keeps a stable prefix and the last four characters', () => {
      expect(maskIdentifier('usr_8f2a9b31')).toBe('usr_••••9b31');
      expect(maskIdentifier('a1b2c3d4e5')).toBe('a1b••••d4e5');
    });

    it('masks short values completely', () => {
      expect(maskIdentifier('ab')).toBe('••');
      expect(maskIdentifier('1234')).toBe('••••');
    });

    it('normalises non-string input instead of throwing', () => {
      expect(maskIdentifier(12345678)).toBe('123••••5678');
      expect(maskIdentifier(undefined)).toBe('');
    });

    it('is idempotent', () => {
      const once = maskIdentifier('usr_8f2a9b31');
      expect(maskIdentifier(once)).toBe(once);
      const noPrefix = maskIdentifier('a1b2c3d4e5');
      expect(maskIdentifier(noPrefix)).toBe(noPrefix);
    });
  });

  describe('maskText', () => {
    it('keeps the first three characters of longer values', () => {
      expect(maskText('North America')).toBe('Nor•••');
      expect(maskText('Lagos')).toBe('Lag•••');
    });

    it('masks short values completely', () => {
      expect(maskText('UK')).toBe('••');
      expect(maskText('')).toBe('');
    });

    it('is idempotent', () => {
      const once = maskText('North America');
      expect(maskText(once)).toBe(once);
    });
  });

  describe('maskValue', () => {
    it('dispatches on the configured mask kind', () => {
      expect(maskValue('email', 'jane@example.com')).toBe('j•••@e•••.com');
      expect(maskValue('identifier', 'usr_8f2a9b31')).toBe('usr_••••9b31');
      expect(maskValue('text', 'North America')).toBe('Nor•••');
    });

    it('falls back to text masking for unknown kinds', () => {
      expect(maskValue('text' as never, 'North America')).toBe('Nor•••');
    });
  });
});
