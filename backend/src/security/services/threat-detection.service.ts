import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    // Calculate total threat score
    threatScore = threats.reduce((sum, t) => sum + t.score, 0);
    detectedType = threats.length > 0 ? threats[0].type : undefined;

    const severity = this.calculateSeverity(threatScore);
    const shouldBlock =
      threatScore >= SECURITY_CONSTANTS.THREAT_SCORES.BLACKLIST_THRESHOLD;

    if (threats.length > 0) {
      await this.logSecurityEvent({
        type: detectedType!,
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
