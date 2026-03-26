import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Encryption result containing encrypted data and IV
 */
export interface EncryptionResult {
  /** Encrypted data as buffer */
  encrypted: Buffer;

  /** Initialization vector (required for decryption) */
  iv: string;

  /** Authentication tag for GCM mode */
  authTag: string;
}

/**
 * Decryption input
 */
export interface DecryptionInput {
  /** Encrypted data */
  encrypted: Buffer;

  /** Initialization vector */
  iv: string;

  /** Authentication tag */
  authTag: string;
}

/**
 * Encryption Service
 *
 * Provides AES-256-GCM encryption for files at rest.
 * GCM mode provides both confidentiality and authenticity.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits for GCM
  private encryptionKey: Buffer | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize encryption key from config
   */
  private async getKey(): Promise<Buffer> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    const keyString = this.configService.get<string>('FILE_ENCRYPTION_KEY');

    if (!keyString) {
      throw new Error(
        'FILE_ENCRYPTION_KEY environment variable is not set. ' +
          'Generate one with: openssl rand -hex 32',
      );
    }

    // If key is hex string, convert to buffer
    if (/^[a-fA-F0-9]{64}$/.test(keyString)) {
      this.encryptionKey = Buffer.from(keyString, 'hex');
    } else {
      // Derive key from password using scrypt
      this.encryptionKey = (await scryptAsync(
        keyString,
        'petchain-salt', // In production, use a proper salt
        this.keyLength,
      )) as Buffer;
    }

    return this.encryptionKey;
  }

  /**
   * Encrypt a buffer using AES-256-GCM
   */
  async encrypt(data: Buffer): Promise<EncryptionResult> {
    const key = await this.getKey();
    const iv = randomBytes(this.ivLength);

    const cipher = createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    this.logger.debug(
      `Encrypted ${data.length} bytes -> ${encrypted.length} bytes`,
    );

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt a buffer using AES-256-GCM
   */
  async decrypt(input: DecryptionInput): Promise<Buffer> {
    const key = await this.getKey();
    const iv = Buffer.from(input.iv, 'hex');
    const authTag = Buffer.from(input.authTag, 'hex');

    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(input.encrypted),
      decipher.final(),
    ]);

    this.logger.debug(
      `Decrypted ${input.encrypted.length} bytes -> ${decrypted.length} bytes`,
    );

    return decrypted;
  }

  /**
   * Encrypt a buffer and return as single buffer with IV and authTag prepended
   * Format: [16 bytes IV][16 bytes authTag][encrypted data]
   */
  async encryptWithMetadata(data: Buffer): Promise<Buffer> {
    const result = await this.encrypt(data);
    const iv = Buffer.from(result.iv, 'hex');
    const authTag = Buffer.from(result.authTag, 'hex');

    return Buffer.concat([iv, authTag, result.encrypted]);
  }

  /**
   * Decrypt a buffer that includes IV and authTag
   * Format: [16 bytes IV][16 bytes authTag][encrypted data]
   */
  async decryptWithMetadata(data: Buffer): Promise<Buffer> {
    if (data.length < this.ivLength + 16) {
      throw new Error('Invalid encrypted data: too short');
    }

    const iv = data.subarray(0, this.ivLength).toString('hex');
    const authTag = data
      .subarray(this.ivLength, this.ivLength + 16)
      .toString('hex');
    const encrypted = data.subarray(this.ivLength + 16);

    return this.decrypt({ encrypted, iv, authTag });
  }

  /**
   * Generate a random encryption key (for key rotation)
   */
  generateKey(): string {
    return randomBytes(this.keyLength).toString('hex');
  }

  /**
   * Check if encryption is properly configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      await this.getKey();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify encryption/decryption works correctly
   */
  async verify(): Promise<boolean> {
    try {
      const testData = Buffer.from('PetChain encryption test');
      const encrypted = await this.encrypt(testData);
      const decrypted = await this.decrypt(encrypted);
      return testData.equals(decrypted);
    } catch (error) {
      this.logger.error('Encryption verification failed:', error);
      return false;
    }
  }
}
