import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User } from '../../modules/users/entities/user.entity';
import { PasswordUtil } from '../utils/password.util';
import { TokenUtil } from '../utils/token.util';
import {
  AuthSecurityEvent,
  AuthSecurityEventType,
} from '../entities/auth-security-event.entity';
import { EmailNotificationService } from './email-notification.service';
import { SessionService } from './session.service';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuthSecurityEvent)
    private readonly securityEventRepository: Repository<AuthSecurityEvent>,
    private readonly configService: ConfigService,
    private readonly emailNotificationService: EmailNotificationService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Starts a password reset flow: stores a hashed token and emails a plain link.
   * Always completes without error (no user enumeration).
   */
  async requestPasswordReset(email: string, ipAddress: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = TokenUtil.hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    user.passwordResetToken = tokenHash;
    user.passwordResetTokenExpiresAt = expiresAt;
    await this.userRepository.save(user);

    await this.securityEventRepository.save(
      this.securityEventRepository.create({
        userId: user.id,
        eventType: AuthSecurityEventType.PASSWORD_RESET_REQUESTED,
        metadata: { ipAddress },
      }),
    );

    const baseUrl =
      this.configService.get<string>('email.appBaseUrl') ??
      'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    void this.emailNotificationService
      .sendPasswordResetEmail(user.email, resetUrl, 60)
      .catch((_err) => undefined);
  }

  /**
   * Validates the reset token, updates the password, clears reset fields,
   * sets {@link User.passwordChangedAt}, revokes sessions, and notifies the user.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = TokenUtil.hashToken(token);
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: tokenHash },
    });

    if (
      !user ||
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt <= new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const bcryptRounds =
      this.configService.get<number>('auth.bcryptRounds') || 12;
    user.password = await PasswordUtil.hashPassword(newPassword, bcryptRounds);
    user.passwordResetToken = null;
    user.passwordResetTokenExpiresAt = null;
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await this.userRepository.save(user);

    await this.sessionService.invalidateAllSessions(user.id);

    await this.securityEventRepository.save(
      this.securityEventRepository.create({
        userId: user.id,
        eventType: AuthSecurityEventType.PASSWORD_RESET_COMPLETED,
        metadata: null,
      }),
    );

    void this.emailNotificationService
      .sendPasswordResetConfirmationEmail(user.email)
      .catch((_err) => undefined);
  }
}
