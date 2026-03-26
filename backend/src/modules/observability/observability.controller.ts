import { Controller, Get, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { AlertingService } from './alerting.service';

@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly alerting: AlertingService,
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
    return this.alerting.getActiveAlerts();
  }
}
