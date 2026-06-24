import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { MetricsService } from './metrics.service';
import { PerformanceInsightsService } from './performance-insights.service';

export interface AlertRule {
  name: string;
  /** Returns true when the alert should fire */
  condition: () => boolean;
  severity: 'warning' | 'critical';
  message: string;
}

export interface Alert {
  name: string;
  severity: 'warning' | 'critical';
  message: string;
  firedAt: string;
}

/**
 * Simple in-process alerting engine.
 * In production wire this to PagerDuty / Alertmanager via webhook.
 */
@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly rules: AlertRule[] = [];
  private readonly firedAlerts: Alert[] = [];

  constructor(
    private readonly metrics: MetricsService,
    private readonly performanceInsights: PerformanceInsightsService,
  ) {
    this._registerDefaultRules();
  }

  @Interval(60000)
  evaluateScheduled(): void {
    this.evaluate();
  }

  registerRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  evaluate(): Alert[] {
    const newAlerts: Alert[] = [];
    const activeAlertNames = new Set(
      this.getActiveAlerts().map((alert) => alert.name),
    );

    for (const rule of this.rules) {
      try {
        if (rule.condition() && !activeAlertNames.has(rule.name)) {
          const alert: Alert = {
            name: rule.name,
            severity: rule.severity,
            message: rule.message,
            firedAt: new Date().toISOString(),
          };
          this.firedAlerts.push(alert);
          newAlerts.push(alert);
          this.logger.warn(
            `[ALERT][${rule.severity.toUpperCase()}] ${rule.name}: ${rule.message}`,
          );
          this.metrics.inc(
            'alerts_fired_total',
            `severity="${rule.severity}",rule="${rule.name}"`,
          );
        }
      } catch {
        // rule evaluation must never crash the app
      }
    }
    return newAlerts;
  }

  getActiveAlerts(): Alert[] {
    // Return alerts from the last 5 minutes
    const cutoff = Date.now() - 5 * 60 * 1000;
    return this.firedAlerts.filter(
      (a) => new Date(a.firedAt).getTime() > cutoff,
    );
  }

  private _registerDefaultRules(): void {
    this.registerRule({
      name: 'high_error_rate',
      severity: 'critical',
      message: 'HTTP 5xx error rate is elevated',
      condition: () => {
        const summary = this.performanceInsights.getSummary();
        return (
          summary.http.totalRequests >= 50 && summary.http.errorRate >= 0.05
        );
      },
    });

    this.registerRule({
      name: 'high_memory_pressure',
      severity: 'warning',
      message: 'Process heap utilization is above 85%',
      condition: () => {
        const summary = this.performanceInsights.getSummary();
        return summary.system.memory.heapUtilizationRatio >= 0.85;
      },
    });

    this.registerRule({
      name: 'high_event_loop_lag',
      severity: 'warning',
      message: 'Average event loop lag is above 250ms',
      condition: () => {
        const summary = this.performanceInsights.getSummary();
        return summary.system.eventLoopLagMs >= 250;
      },
    });
  }
}
