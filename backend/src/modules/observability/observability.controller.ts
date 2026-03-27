import { Controller, Get, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { AlertingService } from './alerting.service';
import { PerformanceInsightsService } from './performance-insights.service';

@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly alerting: AlertingService,
    private readonly performanceInsights: PerformanceInsightsService,
  ) {}

  /** GET /observability/metrics — Prometheus scrape endpoint */
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  getMetrics(@Res() res: Response): void {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(this.metrics.render());
  }

  /** GET /observability/health — liveness probe */
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** GET /observability/alerts — active alert list */
  @Get('alerts')
  alerts() {
    this.alerting.evaluate();
    return this.alerting.getActiveAlerts();
  }

  /** GET /observability/performance — consolidated performance summary */
  @Get('performance')
  performance() {
    return this.performanceInsights.getSummary();
  }
}
