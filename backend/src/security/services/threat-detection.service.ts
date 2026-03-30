import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SecurityEvent,
  SecurityEventType,
  SecuritySeverity,
} from '../entities/security-event.entity';
import { SECURITY_CONSTANTS } from '../constants/security.constants';

export interface ThreatAnalysis {
  isThreat: boolean;
  threatScore: number;
  type?: SecurityEventType;
  severity: SecuritySeverity;
  shouldBlock: boolean;
}

@Injectable()
export class ThreatDetectionService {
  private readonly logger = new Logger(ThreatDetectionService.name);

  constructor(
    @InjectRepository(SecurityEvent)
    private securityEventRepository: Repository<SecurityEvent>,
    private eventEmitter: EventEmitter2,
  ) {}

  async analyzeRequest(request: any): Promise<ThreatAnalysis> {
    let threatScore = 0;
    let detectedType: SecurityEventType | undefined;
    const threats: Array<{ type: SecurityEventType; score: number }> = [];

    // Check for SQL injection
    const sqlThreat = this.detectSqlInjection(request);
    if (sqlThreat) {
      threats.push({
        type: SecurityEventType.SQL_INJECTION_ATTEMPT,
        score: SECURITY_CONSTANTS.THREAT_SCORES.SQL_INJECTION,
      });
    }

    // Check for XSS
    const xssThreat = this.detectXss(request);
    if (xssThreat) {
      threats.push({
        type: SecurityEventType.XSS_ATTEMPT,
        score: SECURITY_CONSTANTS.THREAT_SCORES.XSS_ATTEMPT,
      });
    }

    // Check for path traversal
    const pathThreat = this.detectPathTraversal(request);
    if (pathThreat) {
      threats.push({
        type: SecurityEventType.PATH_TRAVERSAL_ATTEMPT,
        score: SECURITY_CONSTANTS.THREAT_SCORES.SUSPICIOUS_PATTERN,
      });
    }

    // Check for brute force patterns
    const bruteForceThreat = await this.detectBruteForce(request);
    if (bruteForceThreat) {
      threats.push({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        score: SECURITY_CONSTANTS.THREAT_SCORES.BRUTE_FORCE,
      });
    }

    // Check for unauthorized access patterns
    const unauthorizedThreat = this.detectUnauthorizedAccess(request);
    if (unauthorizedThreat) {
      threats.push({
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        score: SECURITY_CONSTANTS.THREAT_SCORES.UNAUTHORIZED_ACCESS,
      });
    }

    // Check for suspicious activity patterns
    const suspiciousThreat = this.detectSuspiciousActivity(request);
    if (suspiciousThreat) {
      threats.push({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        score: SECURITY_CONSTANTS.THREAT_SCORES.SUSPICIOUS_ACTIVITY,
      });
    }

    // Calculate total threat score
    threatScore = threats.reduce((sum, t) => sum + t.score, 0);
    detectedType = threats.length > 0 ? threats[0].type : undefined;

    const severity = this.calculateSeverity(threatScore);
    const shouldBlock =
      threatScore >= SECURITY_CONSTANTS.THREAT_SCORES.BLACKLIST_THRESHOLD;

    if (threats.length > 0) {
      const event = await this.logSecurityEvent({
        type: detectedType,
        severity,
        ipAddress: request.ip,
        userId: request.user?.id,
        description: `Detected ${detectedType}`,
        metadata: {
          endpoint: request.url,
          method: request.method,
          userAgent: request.get('user-agent'),
          threatScore,
        },
        blocked: shouldBlock,
      });

      if (shouldBlock) {
        this.eventEmitter.emit('security.threat.critical', {
          ipAddress: request.ip,
          type: detectedType,
          threatScore,
        });
      }

      // Emit threat detected event for alerting
      this.eventEmitter.emit('security.threat.detected', {
        eventId: event.id,
        type: detectedType,
        severity,
        ipAddress: request.ip,
        userId: request.user?.id,
        metadata: {
          endpoint: request.url,
          method: request.method,
          userAgent: request.get('user-agent'),
          threatScore,
        },
      });
    }

    return {
      isThreat: threats.length > 0,
      threatScore,
      type: detectedType,
      severity,
      shouldBlock,
    };
  }

  private detectSqlInjection(request: any): boolean {
    const payloads = [
      JSON.stringify(request.body),
      JSON.stringify(request.query),
      JSON.stringify(request.params),
    ];

    return payloads.some((payload) =>
      SECURITY_CONSTANTS.PATTERNS.SQL_INJECTION.some((pattern) =>
        pattern.test(payload),
      ),
    );
  }

  private detectXss(request: any): boolean {
    const payloads = [
      JSON.stringify(request.body),
      JSON.stringify(request.query),
      JSON.stringify(request.params),
    ];

    return payloads.some((payload) =>
      SECURITY_CONSTANTS.PATTERNS.XSS.some((pattern) => pattern.test(payload)),
    );
  }

  private detectPathTraversal(request: any): boolean {
    const url = request.url;
    return SECURITY_CONSTANTS.PATTERNS.PATH_TRAVERSAL.some((pattern) =>
      pattern.test(url),
    );
  }

  private async detectBruteForce(request: any): Promise<boolean> {
    // Check for repeated login attempts from same IP
    const recentEvents = await this.securityEventRepository.find({
      where: {
        ipAddress: request.ip,
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
      },
    });

    // If more than 5 brute force attempts in 15 minutes, flag as threat
    if (recentEvents.length >= 5) return true;

    // Check for login endpoint with suspicious patterns
    if (
      request.url.includes('/auth/login') ||
      request.url.includes('/auth/signin')
    ) {
      const failedAttempts = await this.securityEventRepository.count({
        where: {
          ipAddress: request.ip,
          type: In([
            SecurityEventType.UNAUTHORIZED_ACCESS,
            SecurityEventType.BRUTE_FORCE_ATTEMPT,
          ]),
          timestamp: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
        },
      });

      return failedAttempts >= 3;
    }

    return false;
  }

  private detectUnauthorizedAccess(request: any): boolean {
    // Check for access to admin endpoints without proper authentication
    if (request.url.includes('/admin') && !request.user?.isAdmin) {
      return true;
    }

    // Check for API access with invalid tokens
    if (
      request.url.includes('/api') &&
      request.get('authorization') === undefined
    ) {
      return true;
    }

    // Check for suspicious user agent patterns
    const userAgent = request.get('user-agent') || '';
    const suspiciousAgents = [
      'sqlmap',
      'nmap',
      'nikto',
      'dirbuster',
      'gobuster',
      'wpscan',
    ];

    return suspiciousAgents.some((agent) =>
      userAgent.toLowerCase().includes(agent.toLowerCase()),
    );
  }

  private detectSuspiciousActivity(request: any): boolean {
    // Check for unusual request patterns
    const suspiciousPatterns = [
      // Large payloads
      JSON.stringify(request.body || {}).length > 10000,
      // Unusual headers
      request.get('x-forwarded-for') &&
        request.get('x-forwarded-for').split(',').length > 3,
      // Non-standard methods
      !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].includes(
        request.method,
      ),
    ];

    return suspiciousPatterns.some((pattern) => pattern === true);
  }

  private calculateSeverity(threatScore: number): SecuritySeverity {
    if (threatScore >= 100) return SecuritySeverity.CRITICAL;
    if (threatScore >= 80) return SecuritySeverity.HIGH;
    if (threatScore >= 50) return SecuritySeverity.MEDIUM;
    return SecuritySeverity.LOW;
  }

  private async logSecurityEvent(
    data: Partial<SecurityEvent>,
  ): Promise<SecurityEvent> {
    const event = this.securityEventRepository.create(data);
    const saved = await this.securityEventRepository.save(event);

    this.logger.warn(
      `Security event: ${data.type} from ${data.ipAddress} (Score: ${data.metadata?.threatScore})`,
    );

    return saved;
  }

  async getSecurityEvents(filters: {
    ipAddress?: string;
    type?: SecurityEventType;
    severity?: SecuritySeverity;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SecurityEvent[]> {
    const query = this.securityEventRepository.createQueryBuilder('event');

    if (filters.ipAddress)
      query.andWhere('event.ipAddress = :ip', { ip: filters.ipAddress });
    if (filters.type)
      query.andWhere('event.type = :type', { type: filters.type });
    if (filters.severity)
      query.andWhere('event.severity = :severity', {
        severity: filters.severity,
      });
    if (filters.startDate)
      query.andWhere('event.timestamp >= :start', { start: filters.startDate });
    if (filters.endDate)
      query.andWhere('event.timestamp <= :end', { end: filters.endDate });

    query.orderBy('event.timestamp', 'DESC');
    query.limit(filters.limit || 100);

    return query.getMany();
  }
}
