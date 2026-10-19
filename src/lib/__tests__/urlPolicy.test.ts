import {
  isAllowedOrigin,
  stripSensitiveParams,
  checkUrlPolicy,
} from '../urlPolicy';

describe('urlPolicy', () => {
  // ─── isAllowedOrigin ──────────────────────────────────────────────────

  describe('isAllowedOrigin', () => {
    it('allows stellar.expert (wallet explorer)', () => {
      expect(
        isAllowedOrigin('https://stellar.expert/explorer/public/account/GABC...'),
      ).toBe(true);
    });

    it('allows google.com', () => {
      expect(isAllowedOrigin('https://www.google.com/maps/search/?api=1&query=...')).toBe(true);
    });

    it('allows maps.google.com', () => {
      expect(isAllowedOrigin('https://maps.google.com/?q=...')).toBe(true);
    });

    it('allows relative paths', () => {
      expect(isAllowedOrigin('/clinics/123')).toBe(true);
    });

    it('allows hash-only links', () => {
      expect(isAllowedOrigin('#section')).toBe(true);
    });

    it('allows tel: links', () => {
      expect(isAllowedOrigin('tel:+1234567890')).toBe(true);
    });

    it('allows mailto: links', () => {
      expect(isAllowedOrigin('mailto:info@example.com')).toBe(true);
    });

    it('rejects an unknown origin', () => {
      expect(isAllowedOrigin('https://evil.example.com/steal?token=abc')).toBe(false);
    });

    it('rejects javascript: protocol', () => {
      expect(isAllowedOrigin('javascript:alert(1)')).toBe(false);
    });

    it('rejects data: URI', () => {
      expect(isAllowedOrigin('data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });

  // ─── stripSensitiveParams ─────────────────────────────────────────────

  describe('stripSensitiveParams', () => {
    it('removes the hash fragment', () => {
      const result = stripSensitiveParams(
        'https://stellar.expert/explorer/public/account/GABC#session=xyz',
      );
      expect(result).not.toContain('#');
    });

    it('removes sensitive query parameters (token)', () => {
      const result = stripSensitiveParams(
        'https://example.com/callback?token=secret123&q=vet',
      );
      expect(result).not.toContain('token');
      expect(result).toContain('q=vet');
    });

    it('removes sensitive query parameters (access_token)', () => {
      const result = stripSensitiveParams(
        'https://example.com?access_token=abc&search=clinic',
      );
      expect(result).not.toContain('access_token');
      expect(result).toContain('search=clinic');
    });

    it('removes sensitive query parameters (state)', () => {
      const result = stripSensitiveParams(
        'https://example.com?state=csrf-token&q=emergency',
      );
      expect(result).not.toContain('state');
      expect(result).toContain('q=emergency');
    });

    it('removes sensitive query parameters (api_key)', () => {
      const result = stripSensitiveParams(
        'https://example.com?api_key=secret&q=pharmacy',
      );
      expect(result).not.toContain('api_key');
      expect(result).toContain('q=pharmacy');
    });

    it('preserves safe query parameters', () => {
      const result = stripSensitiveParams(
        'https://www.google.com/maps/search/?api=1&query=vet+clinic',
      );
      expect(result).toContain('api=1');
      expect(result).toContain('query=vet+clinic');
    });

    it('strips all sensitive params when only sensitive ones are present', () => {
      const result = stripSensitiveParams(
        'https://example.com?token=abc&state=xyz',
      );
      expect(result).toBe('https://example.com/');
    });

    it('handles a URL with no query string or hash unchanged (except hash removal)', () => {
      const result = stripSensitiveParams('https://stellar.expert/explorer/public/account/GABC');
      expect(result).toBe('https://stellar.expert/explorer/public/account/GABC');
    });

    it('returns the original href when parsing fails', () => {
      const result = stripSensitiveParams('not-a-url');
      expect(result).toBe('not-a-url');
    });
  });

  // ─── checkUrlPolicy ───────────────────────────────────────────────────

  describe('checkUrlPolicy', () => {
    it('allows relative paths', () => {
      const result = checkUrlPolicy('/clinics/123');
      expect(result.allowed).toBe(true);
      expect(result.cleanedHref).toBe('/clinics/123');
    });

    it('allows hash links', () => {
      const result = checkUrlPolicy('#section');
      expect(result.allowed).toBe(true);
      expect(result.cleanedHref).toBe('#section');
    });

    it('allows tel: links', () => {
      const result = checkUrlPolicy('tel:+1234567890');
      expect(result.allowed).toBe(true);
      expect(result.cleanedHref).toBe('tel:+1234567890');
    });

    it('allows mailto: links', () => {
      const result = checkUrlPolicy('mailto:info@example.com');
      expect(result.allowed).toBe(true);
      expect(result.cleanedHref).toBe('mailto:info@example.com');
    });

    it('allows stellar.expert URLs and strips hash', () => {
      const result = checkUrlPolicy(
        'https://stellar.expert/explorer/public/account/GABC#session=xyz',
      );
      expect(result.allowed).toBe(true);
      expect(result.cleanedHref).not.toContain('#');
    });

    it('allows google.com URLs and strips sensitive params', () => {
      const result = checkUrlPolicy(
        'https://www.google.com/maps/search/?api=1&query=vet&token=secret',
      );
      expect(result.allowed).toBe(true);
      expect(result.cleanedHref).toContain('api=1');
      expect(result.cleanedHref).toContain('query=vet');
      expect(result.cleanedHref).not.toContain('token');
    });

    it('blocks unknown origins', () => {
      const result = checkUrlPolicy('https://evil.example.com/phishing');
      expect(result.allowed).toBe(false);
      expect(result.cleanedHref).toBeUndefined();
    });

    it('blocks javascript: protocol', () => {
      const result = checkUrlPolicy('javascript:alert(1)');
      expect(result.allowed).toBe(false);
    });

    it('returns allowed: false for an empty href', () => {
      const result = checkUrlPolicy('');
      expect(result.allowed).toBe(false);
    });
  });
});
