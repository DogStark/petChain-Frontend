import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';

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

  constructor(private readonly metrics: MetricsService) {
    this._registerDefaultRules();
  }

  registerRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  evaluate(): Alert[] {
    const newAlerts: Alert[] = [];
    for (const rule of this.rules) {
      try {
        if (rule.condition()) {
          const alert: Alert = {
            name: rule.name,
            severity: rule.severity,
            message: rule.message,
            firedAt: new Date().toISOString(),
          };
          this.firedAlerts.push(alert);
          newAlerts.push(alert);
          this.logger.warn(`[ALERT][${rule.severity.toUpperCase()}] ${rule.name}: ${rule.message}`);
          this.metrics.inc('alerts_fired_total', `severity="${rule.severity}",rule="${rule.name}"`);
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
    return this.firedAlerts.filter((a) => new Date(a.firedAt).getTime() > cutoff);
  }

  private _registerDefaultRules(): void {
    // These reference metric names tracked by the HTTP interceptor
    this.registerRule({
      name: 'high_error_rate',
      severity: 'critical',
      message: 'HTTP 5xx error rate is elevated',
      condition: () => false, // placeholder — wire to real counter ratio in production
    });
  }
}
