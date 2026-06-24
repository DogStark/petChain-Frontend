import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Sends transactional security emails via SMTP. Failures are logged only.
 */
@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Sends a password reset link email with expiry notice (fire-and-forget safe wrapper).
   */
  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const subject = 'Reset your PetChain password';
    const text = [
      'You requested a password reset.',
      '',
      `Use this link to choose a new password (expires in ${expiresInMinutes} minutes):`,
      resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n');

    await this.sendMailSafe(to, subject, text);
  }

  /**
   * Confirms that the account password was reset successfully.
   */
  async sendPasswordResetConfirmationEmail(to: string): Promise<void> {
    const subject = 'Your password was changed';
    const text = [
      'Your PetChain account password was reset successfully.',
      '',
      'If you did not make this change, contact support immediately.',
    ].join('\n');

    await this.sendMailSafe(to, subject, text);
  }

  /**
   * Notifies the user that their account is temporarily locked after failed sign-ins.
   */
  async sendAccountLockedEmail(to: string, unlocksAt: Date): Promise<void> {
    const subject = 'Your account has been temporarily locked';
    const text = [
      'Your PetChain account has been locked due to multiple failed sign-in attempts.',
      '',
      `You can try again after: ${unlocksAt.toISOString()}`,
      '',
      'If this was not you, we recommend resetting your password once your account unlocks.',
    ].join('\n');

    await this.sendMailSafe(to, subject, text);
  }

  /**
   * Alerts the user of a sign-in from an unfamiliar IP or device.
   */
  async sendSuspiciousLoginEmail(
    to: string,
    ipAddress: string,
    location: string,
    timestamp: Date,
  ): Promise<void> {
    const subject = 'New sign-in to your PetChain account';
    const loc =
      location?.trim().length > 0 ? location : 'Unknown / not available';
    const text = [
      'We noticed a sign-in to your account from a new location or device.',
      '',
      `IP address: ${ipAddress}`,
      `Location: ${loc}`,
      `Time (UTC): ${timestamp.toISOString()}`,
      '',
      'If this was you, no action is needed. If not, reset your password immediately.',
    ].join('\n');

    await this.sendMailSafe(to, subject, text);
  }

  private getTransporter(): Transporter | null {
    const host = this.configService.get<string>('EMAIL_HOST');
    const portRaw = this.configService.get<string>('EMAIL_PORT');
    const user = this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('EMAIL_PASS');

    if (!host || !portRaw || !user || !pass) {
      this.logger.warn(
        'SMTP not fully configured (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS) — skipping send',
      );
      return null;
    }

    const port = parseInt(portRaw, 10);
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  private async sendMailSafe(
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    try {
      const transporter = this.getTransporter();
      if (!transporter) {
        this.logger.debug(`[email skipped] to=${to} subject=${subject}`);
        return;
      }

      const from =
        this.configService.get<string>('EMAIL_FROM') ?? 'noreply@example.com';

      await transporter.sendMail({
        from,
        to,
        subject,
        text,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
