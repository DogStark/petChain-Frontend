import { encryptSecretKey, decryptSecretKey, computeChecksum } from './walletCrypto';

// Polyfill Web Crypto API with Node.js implementation
Object.defineProperty(globalThis, 'crypto', {
  value: require('crypto').webcrypto,
  writable: true,
});

const SAMPLE_SECRET = 'SCZANGBA5YHTNYVSKOP3SJ2LCPZB3NOECJT43BDWGJJL3XSB2BEMDEL';
const PIN = 'correct-pin-1234';

describe('walletCrypto', () => {
  describe('encryptSecretKey / decryptSecretKey', () => {
    it('round-trips a typical Stellar secret key', async () => {
      const { encryptedKey, iv, salt } = await encryptSecretKey(SAMPLE_SECRET, PIN);
      const result = await decryptSecretKey(encryptedKey, iv, salt, PIN);
      expect(result).toBe(SAMPLE_SECRET);
    });

    it('round-trips an empty string plaintext', async () => {
      const { encryptedKey, iv, salt } = await encryptSecretKey('', PIN);
      const result = await decryptSecretKey(encryptedKey, iv, salt, PIN);
      expect(result).toBe('');
    });

    it('round-trips a very long plaintext', async () => {
      const longSecret = 'S' + 'A'.repeat(1000);
      const { encryptedKey, iv, salt } = await encryptSecretKey(longSecret, PIN);
      const result = await decryptSecretKey(encryptedKey, iv, salt, PIN);
      expect(result).toBe(longSecret);
    });

    it('returns different ciphertext on each call (random IV + salt)', async () => {
      const enc1 = await encryptSecretKey(SAMPLE_SECRET, PIN);
      const enc2 = await encryptSecretKey(SAMPLE_SECRET, PIN);
      expect(enc1.encryptedKey).not.toBe(enc2.encryptedKey);
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.salt).not.toBe(enc2.salt);
    });

    it('throws with wrong password — never silently returns wrong plaintext', async () => {
      const { encryptedKey, iv, salt } = await encryptSecretKey(SAMPLE_SECRET, PIN);
      await expect(
        decryptSecretKey(encryptedKey, iv, salt, 'wrong-pin')
      ).rejects.toThrow();
    });

    it('throws when ciphertext is tampered', async () => {
      const { encryptedKey, iv, salt } = await encryptSecretKey(SAMPLE_SECRET, PIN);
      // Flip one base64 character in the ciphertext
      const tampered = encryptedKey.slice(0, -4) + 'AAAA';
      await expect(
        decryptSecretKey(tampered, iv, salt, PIN)
      ).rejects.toThrow();
    });

    it('throws when IV is truncated', async () => {
      const { encryptedKey, iv, salt } = await encryptSecretKey(SAMPLE_SECRET, PIN);
      const truncatedIv = iv.slice(0, 4);
      await expect(
        decryptSecretKey(encryptedKey, truncatedIv, salt, PIN)
      ).rejects.toThrow();
    });
  });

  describe('computeChecksum', () => {
    it('returns a 64-char hex string for non-empty input', async () => {
      const hash = await computeChecksum('hello world');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('is deterministic', async () => {
      const h1 = await computeChecksum('data');
      const h2 = await computeChecksum('data');
      expect(h1).toBe(h2);
    });

    it('differs for different inputs', async () => {
      const h1 = await computeChecksum('input-a');
      const h2 = await computeChecksum('input-b');
      expect(h1).not.toBe(h2);
    });

    it('handles empty string', async () => {
      const hash = await computeChecksum('');
      expect(hash).toHaveLength(64);
    });
  });
});
