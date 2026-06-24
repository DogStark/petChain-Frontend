import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly keys: Map<string, Buffer> = new Map();
  private currentKeyId: string;

  constructor(private readonly configService: ConfigService) {
    this.loadKeys();
  }

  private loadKeys(): void {
    const primary = this.configService.get<string>('FIELD_ENCRYPTION_KEY');
    if (!primary) {
      this.logger.warn(
        'FIELD_ENCRYPTION_KEY not set — field encryption disabled',
      );
      return;
    }

    this.currentKeyId = 'v1';
    this.keys.set('v1', this.deriveKey(primary));

    // Support key rotation: FIELD_ENCRYPTION_KEY_V2, V3, …
    for (let v = 2; v <= 10; v++) {
      const rotated = this.configService.get<string>(
        `FIELD_ENCRYPTION_KEY_V${v}`,
      );
      if (!rotated) break;
      this.currentKeyId = `v${v}`;
      this.keys.set(`v${v}`, this.deriveKey(rotated));
    }
  }

  private deriveKey(secret: string): Buffer {
    return crypto.scryptSync(secret, 'petchain-field-salt', KEY_LENGTH);
  }

  encrypt(plaintext: string): string {
    if (!this.currentKeyId) return plaintext;

    const key = this.keys.get(this.currentKeyId);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Format: keyId:iv:tag:ciphertext (all hex)
    return [
      this.currentKeyId,
      iv.toString('hex'),
      tag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext?.includes(':')) return ciphertext; // not encrypted

    const [keyId, ivHex, tagHex, dataHex] = ciphertext.split(':');
    const key = this.keys.get(keyId);

    if (!key) {
      this.logger.error(`Decryption key '${keyId}' not found`);
      throw new Error(`Unknown encryption key: ${keyId}`);
    }

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(data) + decipher.final('utf8');
  }

  /** Re-encrypt a value with the current (latest) key — used for key rotation */
  reEncrypt(ciphertext: string): string {
    if (!ciphertext?.includes(':')) return this.encrypt(ciphertext);
    const plain = this.decrypt(ciphertext);
    return this.encrypt(plain);
  }

  isEncrypted(value: string): boolean {
    return (
      typeof value === 'string' &&
      value.includes(':') &&
      value.split(':').length === 4
    );
  }
}
