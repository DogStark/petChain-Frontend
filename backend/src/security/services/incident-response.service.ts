import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IpBlacklistService } from './ip-blacklist.service';
import { SecurityEvent, SecurityEventType, SecuritySeverity } from '../entities/security-event.entity';
import { SECURITY_CONSTANTS } from '../constants/security.constants';

export interface IncidentResponseAction {
  type: 'block_ip' | 'notify_admin' | 'escalate' | 'log_only' | 'auto_resolve';
  duration?: number; // in minutes
  reason: string;
}

export interface IncidentResponseRule {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  actions: IncidentResponseAction[];
  cooldownPeriod: number; // minutes before same action can be taken again
}

@Injectable()
export class IncidentResponseService {
  private readonly logger = new Logger(IncidentResponseService.name);

  private readonly responseRules: IncidentResponseRule[] = [
    {
      eventType: SecurityEventType.SQL_INJECTION_ATTEMPT,
      severity: SecuritySeverity.CRITICAL,
      actions: [
        { type: 'block_ip', duration: 60, reason: 'SQL injection attempt' },
        { type: 'notify_admin', reason: 'Critical security threat' },
        { type: 'escalate', reason: 'Immediate escalation required' },
      ],
      cooldownPeriod: 30,
    },
    {
      eventType: SecurityEventType.XSS_ATTEMPT,
      severity: SecuritySeverity.HIGH,
      actions: [
        { type: 'block_ip', duration: 30, reason: 'XSS attempt' },
        { type: 'notify_admin', reason: 'High severity threat' },
      ],
      cooldownPeriod: 15,
    },
    {
      eventType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
      severity: SecuritySeverity.HIGH,
      actions: [
        { type: 'block_ip', duration: 15, reason: 'Brute force attack' },
        { type: 'notify_admin', reason: 'Brute force detected' },
      ],
      cooldownPeriod: 10,
    },
    {
      eventType: SecurityEventType.DDOS_ATTACK,
      severity: SecuritySeverity.CRITICAL,
      actions: [
        { type: 'block_ip', duration: 120, reason: 'DDoS attack' },
        { type: 'notify_admin', reason: 'DDoS attack in progress' },
        { type: 'escalate', reason: 'DDoS mitigation required' },
      ],
      cooldownPeriod: 60,
    },
    {
      eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
      severity: SecuritySeverity.MEDIUM,
      actions: [
        { type: 'log_only', reason: 'Unauthorized access attempt' },
      ],
      cooldownPeriod: 5,
    },
  ];

  private actionCooldowns: Map<string, Date> = new Map();

  constructor(
    @InjectRepository(SecurityEvent)
    private securityEventRepository: Repository<SecurityEvent>,
    private ipBlacklistService: IpBlacklistService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('security.threat.detected')
  async handleThreatDetected(payload: {
    eventId: string;
    type: SecurityEventType;
    severity: SecuritySeverity;
    ipAddress: string;
    userId?: string;
    metadata: any;
  }) {
    const rule = this.findResponseRule(payload.type, payload.severity);
    if (!rule) return;

    await this.executeResponseActions(payload, rule);
  }

  @OnEvent('security.threat.critical')
  async handleCriticalThreat(payload: {
    ipAddress: string;
    type: string;
    threatScore: number;
  }) {
    this.logger.error(`CRITICAL THREAT RESPONSE: ${payload.type} from ${payload.ipAddress}`);

    // Immediate blocking for critical threats
    await this.ipBlacklistService.blacklistIp(
      payload.ipAddress,
      `Critical threat: ${payload.type}`,
      payload.threatScore,
      120, // 2 hours
    );

    // Emit incident response event
    this.eventEmitter.emit('incident.response.executed', {
      ipAddress: payload.ipAddress,
      actions: ['ip_block', 'alert_escalation'],
      severity: SecuritySeverity.CRITICAL,
    });
  }

  private async executeResponseActions(
    payload: {
      eventId: string;
      type: SecurityEventType;
      severity: SecuritySeverity;
      ipAddress: string;
      userId?: string;
      metadata: any;
    },
    rule: IncidentResponseRule,
  ) {
    const executedActions: string[] = [];

    for (const action of rule.actions) {
      const cooldownKey = `${payload.ipAddress}:${action.type}`;
      const lastExecuted = this.actionCooldowns.get(cooldownKey);

      if (lastExecuted && Date.now() - lastExecuted.getTime() < rule.cooldownPeriod * 60 * 1000) {
        this.logger.debug(`Action ${action.type} in cooldown for ${payload.ipAddress}`);
        continue;
      }

      try {
        await this.executeAction(action, payload);
        executedActions.push(action.type);
        this.actionCooldowns.set(cooldownKey, new Date());
      } catch (error) {
        this.logger.error(`Failed to execute action ${action.type}`, error);
      }
    }

    if (executedActions.length > 0) {
      this.logger.log(`Executed incident response actions for ${payload.type}: ${executedActions.join(', ')}`);

      this.eventEmitter.emit('incident.response.executed', {
        eventId: payload.eventId,
        ipAddress: payload.ipAddress,
        actions: executedActions,
        severity: payload.severity,
      });
    }
  }

  private async executeAction(action: IncidentResponseAction, payload: any) {
    switch (action.type) {
      case 'block_ip':
        await this.ipBlacklistService.blacklistIp(
          payload.ipAddress,
          action.reason,
          payload.metadata?.threatScore || 50,
          action.duration,
        );
        break;

      case 'notify_admin':
        this.eventEmitter.emit('alert.security', {
          level: payload.severity,
          message: `${action.reason} from ${payload.ipAddress}`,
          details: payload,
        });
        break;

      case 'escalate':
        this.eventEmitter.emit('incident.escalation', {
          reason: action.reason,
          payload,
          escalationLevel: 'high',
        });
        break;

      case 'auto_resolve':
        await this.securityEventRepository.update(payload.eventId, {
          resolved: true,
        });
        break;

      case 'log_only':
        // Already logged by threat detection service
        break;

      default:
        this.logger.warn(`Unknown action type: ${action.type}`);
    }
  }

  private findResponseRule(eventType: SecurityEventType, severity: SecuritySeverity): IncidentResponseRule | undefined {
    return this.responseRules.find(rule =>
      rule.eventType === eventType && rule.severity === severity
    );
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredCooldowns() {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, timestamp] of this.actionCooldowns.entries()) {
      if (now.getTime() - timestamp.getTime() > 60 * 60 * 1000) { // 1 hour
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.actionCooldowns.delete(key));

    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired cooldowns`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async analyzeThreatPatterns() {
    // Analyze recent security events for patterns
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const events = await this.securityEventRepository.find({
      where: { timestamp: LessThan(oneHourAgo) },
      order: { timestamp: 'DESC' },
      take: 100,
    });

    const ipCounts = new Map<string, number>();
    const typeCounts = new Map<SecurityEventType, number>();

    events.forEach(event => {
      ipCounts.set(event.ipAddress, (ipCounts.get(event.ipAddress) || 0) + 1);
      typeCounts.set(event.type, (typeCounts.get(event.type) || 0) + 1);
    });

    // Check for IPs with high activity
    for (const [ip, count] of ipCounts.entries()) {
      if (count >= 10) {
        this.logger.warn(`High activity detected from IP ${ip}: ${count} events in last hour`);
        this.eventEmitter.emit('security.pattern.detected', {
          type: 'high_activity_ip',
          ipAddress: ip,
          eventCount: count,
          timeWindow: '1_hour',
        });
      }
    }

    // Check for prevalent threat types
    for (const [type, count] of typeCounts.entries()) {
      if (count >= 20) {
        this.logger.warn(`Prevalent threat type: ${type} (${count} events in last hour)`);
        this.eventEmitter.emit('security.pattern.detected', {
          type: 'prevalent_threat',
          threatType: type,
          eventCount: count,
          timeWindow: '1_hour',
        });
      }
    }
  }

  async getResponseRules(): Promise<IncidentResponseRule[]> {
    return [...this.responseRules];
  }

  async updateResponseRule(eventType: SecurityEventType, severity: SecuritySeverity, rule: Partial<IncidentResponseRule>) {
    const existingIndex = this.responseRules.findIndex(r =>
      r.eventType === eventType && r.severity === severity
    );

    if (existingIndex >= 0) {
      this.responseRules[existingIndex] = { ...this.responseRules[existingIndex], ...rule };
    }
  }
}