import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../../modules/users/entities/user.entity';
import { LoginHistory } from '../entities/login-history.entity';
import {
  AuthSecurityEvent,
  AuthSecurityEventType,
} from '../entities/auth-security-event.entity';
import { EmailNotificationService } from './email-notification.service';

@Injectable()
export class LoginAttemptService {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly IP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  private static readonly UA_HISTORY_LIMIT = 50;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepository: Repository<LoginHistory>,
    @InjectRepository(AuthSecurityEvent)
    private readonly securityEventRepository: Repository<AuthSecurityEvent>,
    private readonly configService: ConfigService,
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  /**
   * Records a login outcome, enforces progressive lockout, and returns the
   * successful login row for follow-up anomaly checks.
   */
  async recordAttempt(
    userId: string,
    success: boolean,
    ipAddress: string,
    userAgent: string,
    location?: string | null,
  ): Promise<LoginHistory | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return null;
    }

    if (success) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await this.userRepository.save(user);

      const history = this.loginHistoryRepository.create({
        userId,
        ipAddress,
        userAgent,
        location: location ?? null,
        success: true,
        anomalyFlag: false,
      });
      return await this.loginHistoryRepository.save(history);
    }

    user.failedLoginAttempts += 1;

    const history = this.loginHistoryRepository.create({
      userId,
      ipAddress,
      userAgent,
      location: location ?? null,
      success: false,
      anomalyFlag: false,
    });
    await this.loginHistoryRepository.save(history);

    if (user.failedLoginAttempts >= LoginAttemptService.MAX_ATTEMPTS) {
      const unlocksAt = new Date(
        Date.now() + this.getLockoutDurationMs(),
      );
      user.lockedUntil = unlocksAt;
      await this.userRepository.save(user);

      await this.securityEventRepository.save(
        this.securityEventRepository.create({
          userId,
          eventType: AuthSecurityEventType.ACCOUNT_LOCKED,
          metadata: { ipAddress, userAgent },
        }),
      );

      void this.emailNotificationService
        .sendAccountLockedEmail(user.email, unlocksAt)
        .catch((_err) => undefined);

      throw new HttpException(
        {
          message: 'Account is temporarily locked due to too many failed sign-in attempts',
          unlocksAt,
        },
        HttpStatus.LOCKED,
      );
    }

    await this.userRepository.save(user);
    return null;
  }

  /**
   * Returns lock state; clears an expired lock, logs unlock, and includes unlock time when locked.
   */
  async isAccountLocked(
    userId: string,
  ): Promise<{ locked: boolean; unlocksAt?: Date }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.lockedUntil) {
      return { locked: false };
    }

    if (user.lockedUntil > new Date()) {
      return { locked: true, unlocksAt: user.lockedUntil };
    }

    user.lockedUntil = null;
    await this.userRepository.save(user);

    await this.securityEventRepository.save(
      this.securityEventRepository.create({
        userId,
        eventType: AuthSecurityEventType.ACCOUNT_UNLOCKED,
        metadata: { reason: 'lock_expired' },
      }),
    );

    return { locked: false };
  }

  /**
   * Compares this login to recent successful logins; flags IP / user-agent drift.
   */
  async detectAnomaly(
    userId: string,
    ipAddress: string,
    userAgent: string,
    loginHistoryId: string,
  ): Promise<{ anomalous: boolean; reason?: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return { anomalous: false };
    }

    const windowStart = new Date(
      Date.now() - LoginAttemptService.IP_WINDOW_MS,
    );

    const recentForIp = await this.loginHistoryRepository.find({
      where: {
        userId,
        success: true,
        createdAt: MoreThan(windowStart),
        id: Not(loginHistoryId),
      },
    });

    const ipSeen = recentForIp.some((h) => h.ipAddress === ipAddress);

    const priorUaSamples = await this.loginHistoryRepository.find({
      where: {
        userId,
        success: true,
        id: Not(loginHistoryId),
      },
      order: { createdAt: 'DESC' },
      take: LoginAttemptService.UA_HISTORY_LIMIT,
    });

    const uaSeen = priorUaSamples.some((h) => h.userAgent === userAgent);

    let anomalous = false;
    let reason: string | undefined;

    if (priorUaSamples.length > 0 && !ipSeen) {
      anomalous = true;
      reason = 'IP address not seen in the last 30 days';
    }

    if (priorUaSamples.length > 0 && !uaSeen) {
      anomalous = true;
      reason = !reason
        ? 'User agent not seen on previous successful sign-ins'
        : `${reason}; new user agent`;
    }

    if (!anomalous) {
      return { anomalous: false };
    }

    await this.loginHistoryRepository.update(
      { id: loginHistoryId },
      { anomalyFlag: true },
    );

    await this.securityEventRepository.save(
      this.securityEventRepository.create({
        userId,
        eventType: AuthSecurityEventType.SUSPICIOUS_LOGIN,
        metadata: {
          ipAddress,
          userAgent,
          reason,
        },
      }),
    );

    void this.emailNotificationService
      .sendSuspiciousLoginEmail(
        user.email,
        ipAddress,
        '',
        new Date(),
      )
      .catch((_err) => undefined);

    return { anomalous: true, reason };
  }

  private getLockoutDurationMs(): number {
    const raw =
      this.configService.get<string>('auth.accountLockoutDuration') ?? '30m';
    const match = raw.match(/^(\d+)m$/i);
    if (match) {
      return parseInt(match[1], 10) * 60 * 1000;
    }
    const fallback = parseInt(raw.replace(/[^0-9]/g, '') || '30', 10);
    return fallback * 60 * 1000;
  }
}
