import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * AES-256-GCM encryption utility for wallet private key encryption.
 * Uses authenticated encryption to prevent tampering.
 */
export class AesEncryption {
  /**
   * Derive a 32-byte key from master key (base64) or generate from password + salt.
   */
  static getKey(masterKeyBase64: string): Buffer {
    const key = Buffer.from(masterKeyBase64, 'base64');
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `Master key must be base64-encoded and decode to ${KEY_LENGTH} bytes for AES-256 (use: openssl rand -base64 32)`,
      );
    }
    return key;
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   */
  static encrypt(plaintext: string, key: Buffer): { ciphertext: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  /**
   * Decrypt ciphertext encrypted with AES-256-GCM.
   */
  static decrypt(
    ciphertext: string,
    iv: string,
    authTag: string,
    key: Buffer,
  ): string {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'base64'),
      { authTagLength: AUTH_TAG_LENGTH },
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Generate a random salt for key derivation.
   */
  static generateSalt(): string {
    return crypto.randomBytes(SALT_LENGTH).toString('base64');
  }
}
