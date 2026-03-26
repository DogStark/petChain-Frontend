import { TokenUtil } from './token.util';

describe('TokenUtil', () => {
  describe('generateToken', () => {
    it('should generate a token of default length', () => {
      const token = TokenUtil.generateToken();
      expect(token).toBeDefined();
      expect(token).toHaveLength(64); // 32 bytes = 64 hex characters
    });

    it('should generate a token of specified length', () => {
      const token = TokenUtil.generateToken(16);
      expect(token).toBeDefined();
      expect(token).toHaveLength(32); // 16 bytes = 32 hex characters
    });

    it('should generate unique tokens', () => {
      const token1 = TokenUtil.generateToken();
      const token2 = TokenUtil.generateToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate hex string tokens', () => {
      const token = TokenUtil.generateToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('hashToken', () => {
    it('should hash a token consistently', () => {
      const token = 'test-token-123';
      const hash1 = TokenUtil.hashToken(token);
      const hash2 = TokenUtil.hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex string length
    });

    it('should produce different hashes for different tokens', () => {
      const token1 = 'test-token-123';
      const token2 = 'test-token-456';
      const hash1 = TokenUtil.hashToken(token1);
      const hash2 = TokenUtil.hashToken(token2);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce a hex string hash', () => {
      const token = 'test-token';
      const hash = TokenUtil.hashToken(token);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('verifyToken', () => {
    it('should return true for matching token and hash', () => {
      const token = 'test-token-123';
      const hash = TokenUtil.hashToken(token);
      const isValid = TokenUtil.verifyToken(token, hash);

      expect(isValid).toBe(true);
    });

    it('should return false for non-matching token and hash', () => {
      const token1 = 'test-token-123';
      const token2 = 'test-token-456';
      const hash = TokenUtil.hashToken(token1);
      const isValid = TokenUtil.verifyToken(token2, hash);

      expect(isValid).toBe(false);
    });

    it('should return false for invalid hash', () => {
      const token = 'test-token-123';
      const invalidHash = 'invalid-hash-string';
      const isValid = TokenUtil.verifyToken(token, invalidHash);

      expect(isValid).toBe(false);
    });
  });
});
