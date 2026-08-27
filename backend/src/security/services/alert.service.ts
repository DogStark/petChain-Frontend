import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import {
  SecurityEvent,
  SecurityEventType,
  SecuritySeverity,
} from '../entities/security-event.entity';
import { NotificationCategory } from '../../modules/notifications/entities/notification.entity';

export interface AlertConfig {
  severity: SecuritySeverity;
  enabled: boolean;
  notifyAdmins: boolean;
  escalateAfterMinutes?: number;
  autoResolve?: boolean;
}

export interface AlertRule {
  eventType: SecurityEventType;
  config: AlertConfig;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  private readonly alertRules: Map<SecurityEventType, AlertConfig> = new Map([
    [
      SecurityEventType.SQL_INJECTION_ATTEMPT,
      {
        severity: SecuritySeverity.CRITICAL,
        enabled: true,
        notifyAdmins: true,
        escalateAfterMinutes: 5,
      },
    ],
    [
      SecurityEventType.XSS_ATTEMPT,
      {
        severity: SecuritySeverity.HIGH,
        enabled: true,
        notifyAdmins: true,
        escalateAfterMinutes: 10,
      },
    ],
    [
      SecurityEventType.BRUTE_FORCE_ATTEMPT,
      {
        severity: SecuritySeverity.HIGH,
        enabled: true,
        notifyAdmins: true,
        escalateAfterMinutes: 15,
      },
    ],
    [
      SecurityEventType.DDOS_ATTACK,
      {
        severity: SecuritySeverity.CRITICAL,
        enabled: true,
        notifyAdmins: true,
        escalateAfterMinutes: 2,
      },
    ],
    [
      SecurityEventType.UNAUTHORIZED_ACCESS,
      {
        severity: SecuritySeverity.MEDIUM,
        enabled: true,
        notifyAdmins: false,
      },
    ],
    [
      SecurityEventType.RATE_LIMIT_EXCEEDED,
      {
        severity: SecuritySeverity.LOW,
        enabled: true,
        notifyAdmins: false,
      },
    ],
  ]);

  constructor(
    @InjectRepository(SecurityEvent)
    private securityEventRepository: Repository<SecurityEvent>,
    private notificationsService: NotificationsService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('alert.security')
  async handleSecurityAlert(payload: {
    level: SecuritySeverity;
    message: string;
    details: any;
    eventId?: string;
  }) {
    const rule = this.findAlertRule(payload.details?.type);
    if (!rule?.config.enabled) return;

    await this.createAlert(payload, rule.config);
  }

  @OnEvent('security.threat.detected')
  async handleThreatDetected(payload: {
    eventId: string;
    type: SecurityEventType;
    severity: SecuritySeverity;
    ipAddress: string;
    userId?: string;
    metadata: any;
  }) {
    const rule = this.alertRules.get(payload.type);
    if (!rule?.enabled) return;

    const message = this.generateAlertMessage(payload);
    await this.createAlert(
      {
        level: payload.severity,
        message,
        details: payload,
        eventId: payload.eventId,
      },
      rule,
    );
  }

  private async createAlert(
    payload: {
      level: SecuritySeverity;
      message: string;
      details: any;
      eventId?: string;
    },
    config: AlertConfig,
  ) {
    this.logger.warn(`SECURITY ALERT [${payload.level}]: ${payload.message}`);

    // Create notification for admins if configured
    if (config.notifyAdmins) {
      await this.notifyAdmins(payload.message, payload.details, payload.level);
    }

    // Emit real-time alert
    this.eventEmitter.emit('alert.realtime', {
      type: 'security',
      severity: payload.level,
      message: payload.message,
      details: payload.details,
      timestamp: new Date(),
    });

    // Schedule escalation if configured
    if (config.escalateAfterMinutes) {
      setTimeout(
        () => {
          this.escalateAlert(payload, config);
        },
        config.escalateAfterMinutes * 60 * 1000,
      );
    }
  }

  private async notifyAdmins(
    message: string,
    details: any,
    severity: SecuritySeverity,
  ) {
    try {
      // Get admin user IDs (you might want to have a separate admin role or config)
      const adminUserIds = await this.getAdminUserIds();

      for (const adminId of adminUserIds) {
        await this.notificationsService.create({
          userId: adminId,
          title: `Security Alert - ${severity}`,
          message,
          category: NotificationCategory.ALERT,
          actionUrl: `/admin/security/events/${details.eventId}`,
          metadata: {
            severity,
            details,
            alertType: 'security',
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to send admin notifications', error);
    }
  }

  private async escalateAlert(
    payload: { level: SecuritySeverity; message: string; details: any },
    config: AlertConfig,
  ) {
    const escalatedMessage = `ESCALATED: ${payload.message}`;

    this.logger.error(`ALERT ESCALATION: ${escalatedMessage}`);

    // Additional escalation actions could include:
    // - Send SMS alerts
    // - Call incident response team
    // - Lock down systems
    // - Notify external security services

    this.eventEmitter.emit('alert.escalated', {
      originalAlert: payload,
      escalationTime: new Date(),
      actions: ['admin_notification', 'logging'],
    });
  }

  private findAlertRule(
    eventType: SecurityEventType,
  ): { config: AlertConfig } | undefined {
    const config = this.alertRules.get(eventType);
    return config ? { config } : undefined;
  }

  private generateAlertMessage(payload: {
    type: SecurityEventType;
    severity: SecuritySeverity;
    ipAddress: string;
    userId?: string;
    metadata: any;
  }): string {
    const userInfo = payload.userId ? ` (User: ${payload.userId})` : '';
    const endpoint = payload.metadata?.endpoint || 'unknown';

    return `${payload.type} detected from ${payload.ipAddress}${userInfo} on ${endpoint}`;
  }

  private async getAdminUserIds(): Promise<string[]> {
    // TODO: Implement proper admin user retrieval
    // For now, return empty array - you should implement this based on your user roles
    return [];
  }

  async updateAlertRule(
    eventType: SecurityEventType,
    config: Partial<AlertConfig>,
  ) {
    const existing = this.alertRules.get(eventType);
    if (existing) {
      this.alertRules.set(eventType, { ...existing, ...config });
    }
  }

  getAlertRules(): Map<SecurityEventType, AlertConfig> {
    return new Map(this.alertRules);
  }
}
