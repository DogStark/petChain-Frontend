import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { IpBlacklistService } from './ip-blacklist.service';
import { SECURITY_CONSTANTS } from '../constants/security.constants';

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(
    private ipBlacklistService: IpBlacklistService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('security.threat.critical')
  async handleCriticalThreat(payload: {
    ipAddress: string;
    type: string;
    threatScore: number;
  }) {
    this.logger.error(
      `CRITICAL THREAT: ${payload.type} from ${payload.ipAddress}`,
    );

    // Auto-blacklist for critical threats
    await this.ipBlacklistService.blacklistIp(
      payload.ipAddress,
      `Auto-blacklisted: ${payload.type}`,
      payload.threatScore,
      60, // 1 hour
    );

    // Send alert (integrate with notification system)
    this.eventEmitter.emit('alert.security', {
      level: 'critical',
      message: `Critical security threat detected from ${payload.ipAddress}`,
      details: payload,
    });
  }

  @OnEvent('security.rate.limit.exceeded')
  async handleRateLimitExceeded(payload: {
    ipAddress: string;
    endpoint: string;
    attempts: number;
  }) {
    this.logger.warn(
      `Rate limit exceeded: ${payload.ipAddress} on ${payload.endpoint}`,
    );

    if (payload.attempts > 50) {
      await this.ipBlacklistService.blacklistIp(
        payload.ipAddress,
        'Excessive rate limit violations',
        SECURITY_CONSTANTS.THREAT_SCORES.RATE_LIMIT_EXCEEDED,
        30, // 30 minutes
      );
    }
  }
}
