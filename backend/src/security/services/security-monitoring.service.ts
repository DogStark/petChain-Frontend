import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { SecurityEvent, SecurityEventType, SecuritySeverity } from '../entities/security-event.entity';
import { BlacklistedIp } from '../entities/blacklisted-ip.entity';

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<SecuritySeverity, number>;
  blockedRequests: number;
  activeBlacklistedIPs: number;
  recentThreats: SecurityEvent[];
  threatTrends: {
    period: string;
    events: number;
    blocked: number;
  }[];
}

export interface RealTimeAlert {
  id: string;
  type: 'threat' | 'system' | 'performance';
  severity: SecuritySeverity;
  message: string;
  details: any;
  timestamp: Date;
  acknowledged: boolean;
}

@Injectable()
export class SecurityMonitoringService {
  private readonly logger = new Logger(SecurityMonitoringService.name);
  private activeAlerts: Map<string, RealTimeAlert> = new Map();

  constructor(
    @InjectRepository(SecurityEvent)
    private securityEventRepository: Repository<SecurityEvent>,
    @InjectRepository(BlacklistedIp)
    private blacklistRepository: Repository<BlacklistedIp>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('security.threat.detected')
  async handleThreatDetected(payload: {
    eventId: string;
    type: SecurityEventType;
    severity: SecuritySeverity;
    ipAddress: string;
    metadata: any;
  }) {
    const alert: RealTimeAlert = {
      id: payload.eventId,
      type: 'threat',
      severity: payload.severity,
      message: `${payload.type} detected from ${payload.ipAddress}`,
      details: payload,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.activeAlerts.set(alert.id, alert);

    // Emit real-time update
    this.eventEmitter.emit('monitoring.alert.new', alert);

    // Auto-acknowledge low severity alerts after 5 minutes
    if (payload.severity === SecuritySeverity.LOW) {
      setTimeout(() => {
        this.acknowledgeAlert(alert.id);
      }, 5 * 60 * 1000);
    }
  }

  @OnEvent('incident.response.executed')
  async handleIncidentResponse(payload: {
    eventId?: string;
    ipAddress: string;
    actions: string[];
    severity: SecuritySeverity;
  }) {
    const alert: RealTimeAlert = {
      id: `response_${Date.now()}`,
      type: 'system',
      severity: payload.severity,
      message: `Incident response executed: ${payload.actions.join(', ')} for ${payload.ipAddress}`,
      details: payload,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.activeAlerts.set(alert.id, alert);
    this.eventEmitter.emit('monitoring.alert.new', alert);
  }

  async getSecurityMetrics(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<SecurityMetrics> {
    const cacheKey = `security_metrics_${timeRange}`;
    const cached = await this.cacheManager.get<SecurityMetrics>(cacheKey);

    if (cached) return cached;

    const now = new Date();
    const timeRangeMs = this.getTimeRangeMs(timeRange);
    const startDate = new Date(now.getTime() - timeRangeMs);

    // Get events in time range
    const events = await this.securityEventRepository.find({
      where: { timestamp: MoreThan(startDate) },
      order: { timestamp: 'DESC' },
    });

    // Calculate metrics
    const eventsByType = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<SecurityEventType, number>);

    const eventsBySeverity = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<SecuritySeverity, number>);

    const blockedRequests = events.filter(e => e.blocked).length;

    const activeBlacklistedIPs = await this.blacklistRepository.count({
      where: [
        { isPermanent: true },
        { isPermanent: false, expiresAt: MoreThan(now) },
      ],
    });

    const recentThreats = events.slice(0, 10);

    const metrics: SecurityMetrics = {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      blockedRequests,
      activeBlacklistedIPs,
      recentThreats,
      threatTrends: await this.calculateThreatTrends(timeRange),
    };

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, metrics, 300000);

    return metrics;
  }

  async getActiveAlerts(): Promise<RealTimeAlert[]> {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.acknowledged);
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    this.eventEmitter.emit('monitoring.alert.acknowledged', alert);

    // Keep acknowledged alerts for 1 hour then remove
    setTimeout(() => {
      this.activeAlerts.delete(alertId);
    }, 60 * 60 * 1000);

    return true;
  }

  async getThreatIntelligence(): Promise<{
    topThreatSources: Array<{ ip: string; count: number; lastSeen: Date }>;
    threatPatterns: Array<{ type: SecurityEventType; frequency: number; trend: 'increasing' | 'decreasing' | 'stable' }>;
    riskScore: number;
  }> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get threat sources
    const threatEvents = await this.securityEventRepository
      .createQueryBuilder('event')
      .select('event.ipAddress', 'ip')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(event.timestamp)', 'lastSeen')
      .where('event.timestamp > :last24h', { last24h })
      .groupBy('event.ipAddress')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const topThreatSources = threatEvents.map(row => ({
      ip: row.ip,
      count: parseInt(row.count),
      lastSeen: new Date(row.lastSeen),
    }));

    // Get threat patterns
    const typeEvents = await this.securityEventRepository
      .createQueryBuilder('event')
      .select('event.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('event.timestamp > :last7d', { last7d })
      .groupBy('event.type')
      .getRawMany();

    const threatPatterns = typeEvents.map(row => ({
      type: row.type as SecurityEventType,
      frequency: parseInt(row.count),
      trend: 'stable' as const, // Would need more complex logic for trend analysis
    }));

    // Calculate risk score (0-100)
    const totalEvents = await this.securityEventRepository.count({
      where: { timestamp: MoreThan(last24h) },
    });

    const criticalEvents = await this.securityEventRepository.count({
      where: {
        timestamp: MoreThan(last24h),
        severity: SecuritySeverity.CRITICAL,
      },
    });

    const riskScore = Math.min(100, (totalEvents * 2) + (criticalEvents * 10));

    return {
      topThreatSources,
      threatPatterns,
      riskScore,
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateMetricsCache() {
    // Pre-warm caches for different time ranges
    await Promise.all([
      this.getSecurityMetrics('1h'),
      this.getSecurityMetrics('24h'),
      this.getSecurityMetrics('7d'),
    ]);

    // Emit periodic health check
    this.eventEmitter.emit('monitoring.health.check', {
      timestamp: new Date(),
      status: 'healthy',
      activeAlerts: this.activeAlerts.size,
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldAlerts() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const toRemove: string[] = [];

    for (const [id, alert] of this.activeAlerts.entries()) {
      if (alert.timestamp < oneHourAgo) {
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => this.activeAlerts.delete(id));

    if (toRemove.length > 0) {
      this.logger.debug(`Cleaned up ${toRemove.length} old alerts`);
    }
  }

  private getTimeRangeMs(timeRange: '1h' | '24h' | '7d'): number {
    switch (timeRange) {
      case '1h': return 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private async calculateThreatTrends(timeRange: '1h' | '24h' | '7d'): Promise<SecurityMetrics['threatTrends']> {
    const now = new Date();
    const periods = timeRange === '1h' ? 6 : timeRange === '24h' ? 24 : 7;
    const periodMs = this.getTimeRangeMs(timeRange) / periods;

    const trends = [];

    for (let i = periods - 1; i >= 0; i--) {
      const periodStart = new Date(now.getTime() - (i + 1) * periodMs);
      const periodEnd = new Date(now.getTime() - i * periodMs);

      const events = await this.securityEventRepository.count({
        where: {
          timestamp: MoreThan(periodStart),
          ... (i < periods - 1 ? { timestamp: LessThan(periodEnd) } : {}),
        },
      });

      const blocked = await this.securityEventRepository.count({
        where: {
          timestamp: MoreThan(periodStart),
          blocked: true,
          ... (i < periods - 1 ? { timestamp: LessThan(periodEnd) } : {}),
        },
      });

      trends.push({
        period: periodStart.toISOString(),
        events,
        blocked,
      });
    }

    return trends;
  }
}