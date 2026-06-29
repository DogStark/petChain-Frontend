import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { MfaRecord } from './entities/mfa-record.entity';

/**
 * Minimal TOTP implementation following RFC 6238
 */
const TOTP_WINDOW = 30; // seconds per time window
const TOTP_DIGITS = 6;

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(MfaRecord)
    private readonly mfaRepository: Repository<MfaRecord>,
  ) {}

  /**
   * Generate TOTP secret (32 bytes base32 encoded)
   */
  generateTotpSecret(): string {
    const secret = randomBytes(32);
    return this.base32Encode(secret);
  }

  /**
   * Create a new MFA record with TOTP
   */
  async setupTotp(userId: string): Promise<{ secret: string; record: MfaRecord }> {
    const secret = this.generateTotpSecret();
    const record = await this.mfaRepository.create({
      userId,
      method: 'totp',
      totpSecret: secret,
      verified: false,
      enabled: true,
    });

    const saved = await this.mfaRepository.save(record);
    return { secret, record: saved };
  }

  /**
   * Verify TOTP code against secret and mark as verified
   */
  async verifyAndEnableTotp(
    recordId: string,
    userId: string,
    totpCode: string,
  ): Promise<MfaRecord> {
    const record = await this.mfaRepository.findOne({
      where: { id: recordId, userId, method: 'totp' },
    });

    if (!record) {
      throw new BadRequestException('MFA record not found');
    }

    if (record.verified) {
      throw new BadRequestException('MFA already verified');
    }

    const isValid = this.verifyTotp(record.totpSecret, totpCode);
    if (!isValid) {
      throw new ForbiddenException('Invalid TOTP code');
    }

    record.verified = true;
    record.verifiedAt = new Date();
    return this.mfaRepository.save(record);
  }

  /**
   * Verify a TOTP code (with ±1 time window tolerance)
   */
  verifyTotp(secret: string, code: string): boolean {
    if (!secret || !code || code.length !== TOTP_DIGITS) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    for (let i = -1; i <= 1; i++) {
      const timeCounter = Math.floor((now + i * TOTP_WINDOW) / TOTP_WINDOW);
      const expectedCode = this.generateTotp(secret, timeCounter);
      if (code === expectedCode) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate backup codes (10 codes, 8 alphanumeric each)
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(randomBytes(6).toString('hex').toUpperCase().slice(0, 8));
    }
    return codes;
  }

  /**
   * Create MFA record with backup codes
   */
  async setupBackupCodes(userId: string): Promise<{ codes: string[]; record: MfaRecord }> {
    const codes = this.generateBackupCodes();
    const hashedCodes = codes.map((c) => this.hashCode(c));

    const record = await this.mfaRepository.create({
      userId,
      method: 'backup-codes',
      backupCodes: JSON.stringify(hashedCodes),
      verified: true,
      verifiedAt: new Date(),
      enabled: true,
    });

    const saved = await this.mfaRepository.save(record);
    return { codes, record: saved };
  }

  /**
   * Consume a backup code (mark as used by removing from list)
   */
  async consumeBackupCode(
    recordId: string,
    userId: string,
    code: string,
  ): Promise<boolean> {
    const record = await this.mfaRepository.findOne({
      where: { id: recordId, userId, method: 'backup-codes' },
    });

    if (!record || !record.enabled) {
      return false;
    }

    const hashedCode = this.hashCode(code);
    const codes: string[] = JSON.parse(record.backupCodes || '[]');
    const idx = codes.indexOf(hashedCode);

    if (idx === -1) {
      return false;
    }

    // Remove used code
    codes.splice(idx, 1);
    record.backupCodes = JSON.stringify(codes);

    // Disable if no codes left
    if (codes.length === 0) {
      record.enabled = false;
    }

    await this.mfaRepository.save(record);
    return true;
  }

  /**
   * Get active MFA for a user
   */
  async getActiveMfa(userId: string): Promise<MfaRecord | null> {
    return this.mfaRepository.findOne({
      where: { userId, enabled: true, verified: true },
    });
  }

  /**
   * Disable MFA for user
   */
  async disableMfa(recordId: string, userId: string): Promise<void> {
    const record = await this.mfaRepository.findOne({
      where: { id: recordId, userId },
    });

    if (!record) {
      throw new BadRequestException('MFA record not found');
    }

    record.enabled = false;
    await this.mfaRepository.save(record);
  }

  // ===== Private helpers =====

  private generateTotp(secret: string, counter: number): string {
    const decodedSecret = this.base32Decode(secret);
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));

    const hmac = createHash('sha1');
    hmac.update(Buffer.concat([decodedSecret, buf]));
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0x0f;
    const code =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    return (code % Math.pow(10, TOTP_DIGITS))
      .toString()
      .padStart(TOTP_DIGITS, '0');
  }

  private base32Encode(buf: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let result = '';

    for (let i = 0; i < buf.length; i++) {
      value = (value << 8) | buf[i];
      bits += 8;

      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 31];
    }

    return result;
  }

  private base32Decode(str: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const result: number[] = [];

    for (let i = 0; i < str.length; i++) {
      const idx = alphabet.indexOf(str[i].toUpperCase());
      if (idx === -1) throw new Error('Invalid base32 character');

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        result.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(result);
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
