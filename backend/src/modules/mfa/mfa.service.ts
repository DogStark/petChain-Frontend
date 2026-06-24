import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MfaConfig } from './entities/mfa-config.entity';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

// speakeasy is a lightweight TOTP library; use dynamic require for optional dep
let speakeasy: any;
try {
  speakeasy = require('speakeasy');
} catch {
  speakeasy = null;
}

const BACKUP_CODE_COUNT = 10;
const APP_NAME = 'PetChain';

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(MfaConfig)
    private readonly mfaRepo: Repository<MfaConfig>,
  ) {}

  /** Step 1: Generate a new TOTP secret and return QR code data URL. */
  async setupMfa(userId: string): Promise<{ qrCodeUrl: string; secret: string }> {
    this.ensureSpeakeasy();

    const secretObj = speakeasy.generateSecret({
      name: `${APP_NAME} (${userId})`,
      length: 20,
    });

    // Persist secret (not yet enabled — user must verify first)
    let config = await this.mfaRepo.findOne({ where: { userId } });
    if (!config) {
      config = this.mfaRepo.create({ userId });
    }
    config.secret = secretObj.base32;
    config.isEnabled = false;
    await this.mfaRepo.save(config);

    const qrCodeUrl = await QRCode.toDataURL(secretObj.otpauth_url);
    return { qrCodeUrl, secret: secretObj.base32 };
  }

  /** Step 2: Verify the TOTP token and enable MFA. Returns backup codes. */
  async enableMfa(userId: string, token: string): Promise<{ backupCodes: string[] }> {
    this.ensureSpeakeasy();
    const config = await this.getConfig(userId);

    if (!config.secret) {
      throw new BadRequestException('MFA setup not initiated. Call /mfa/setup first.');
    }

    const valid = speakeasy.totp.verify({
      secret: config.secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) throw new UnauthorizedException('Invalid TOTP token');

    const plainCodes = this.generateBackupCodes();
    config.backupCodes = plainCodes.map((c) => this.hashCode(c));
    config.usedBackupCodes = [];
    config.isEnabled = true;
    await this.mfaRepo.save(config);

    return { backupCodes: plainCodes };
  }

  /** Verify a TOTP token for an already-enabled MFA. */
  async verifyTotp(userId: string, token: string): Promise<boolean> {
    this.ensureSpeakeasy();
    const config = await this.getConfig(userId);

    if (!config.isEnabled || !config.secret) return false;

    return speakeasy.totp.verify({
      secret: config.secret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }

  /** Verify and consume a single-use backup code. */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const config = await this.getConfig(userId);
    if (!config.isEnabled) return false;

    const hashed = this.hashCode(code);
    const isValid = config.backupCodes.includes(hashed);
    const alreadyUsed = config.usedBackupCodes.includes(hashed);

    if (!isValid || alreadyUsed) return false;

    config.usedBackupCodes = [...config.usedBackupCodes, hashed];
    await this.mfaRepo.save(config);
    return true;
  }

  /** Disable MFA and clear all secrets/backup codes. */
  async disableMfa(userId: string, token: string): Promise<void> {
    const valid = await this.verifyTotp(userId, token);
    if (!valid) throw new UnauthorizedException('Invalid TOTP token');

    const config = await this.getConfig(userId);
    config.isEnabled = false;
    config.secret = null;
    config.backupCodes = [];
    config.usedBackupCodes = [];
    await this.mfaRepo.save(config);
  }

  /** Regenerate backup codes (requires valid TOTP). */
  async regenerateBackupCodes(userId: string, token: string): Promise<{ backupCodes: string[] }> {
    const valid = await this.verifyTotp(userId, token);
    if (!valid) throw new UnauthorizedException('Invalid TOTP token');

    const config = await this.getConfig(userId);
    const plainCodes = this.generateBackupCodes();
    config.backupCodes = plainCodes.map((c) => this.hashCode(c));
    config.usedBackupCodes = [];
    await this.mfaRepo.save(config);

    return { backupCodes: plainCodes };
  }

  async getMfaStatus(userId: string): Promise<{ isEnabled: boolean; backupCodesRemaining: number }> {
    const config = await this.mfaRepo.findOne({ where: { userId } });
    if (!config) return { isEnabled: false, backupCodesRemaining: 0 };

    const remaining = config.backupCodes.filter(
      (c) => !config.usedBackupCodes.includes(c),
    ).length;

    return { isEnabled: config.isEnabled, backupCodesRemaining: remaining };
  }

  private async getConfig(userId: string): Promise<MfaConfig> {
    const config = await this.mfaRepo.findOne({ where: { userId } });
    if (!config) throw new NotFoundException('MFA configuration not found');
    return config;
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: BACKUP_CODE_COUNT }, () =>
      crypto.randomBytes(5).toString('hex').toUpperCase(),
    );
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private ensureSpeakeasy(): void {
    if (!speakeasy) {
      throw new BadRequestException(
        'speakeasy package not installed. Run: npm install speakeasy',
      );
    }
  }
}
