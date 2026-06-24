import {
  Controller,
  Get,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { Response } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MetricsService } from './metrics.service';
import { AlertingService } from './alerting.service';
import { PerformanceInsightsService } from './performance-insights.service';

@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly alerting: AlertingService,
    private readonly performanceInsights: PerformanceInsightsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** GET /observability/metrics — Prometheus scrape endpoint (token-protected) */
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  getMetrics(
    @Res() res: Response,
    @Headers('x-metrics-token') token: string,
  ): void {
    const expected = process.env.METRICS_TOKEN;
    if (expected && token !== expected) {
      throw new UnauthorizedException('Invalid metrics token');
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(this.metrics.render());
  }

  /** GET /observability/health — liveness + DB + Redis probe */
  @Get('health')
  async health() {
    const [db, redis] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
    ]);
    return {
      status: db === 'connected' && redis === 'connected' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      db,
      redis,
    };
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

  private async checkDb(): Promise<'connected' | 'error'> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'connected';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<'connected' | 'error'> {
    try {
      // ioredis client may be available via cache manager; attempt a simple ping
      const { Redis } = await import('ioredis');
      const client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        lazyConnect: true,
        connectTimeout: 2000,
      });
      await client.ping();
      await client.quit();
      return 'connected';
    } catch {
      return 'error';
    }
  }
}
