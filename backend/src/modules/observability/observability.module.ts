import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { TracingService } from './tracing.service';
import { LogAggregatorService } from './log-aggregator.service';
import { AlertingService } from './alerting.service';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { ObservabilityController } from './observability.controller';
import { PerformanceMonitoringService } from './performance-monitoring.service';
import { PerformanceInsightsService } from './performance-insights.service';

@Global()
@Module({
  controllers: [ObservabilityController],
  providers: [
    MetricsService,
    TracingService,
    LogAggregatorService,
    AlertingService,
    PerformanceMonitoringService,
    PerformanceInsightsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [
    MetricsService,
    TracingService,
    LogAggregatorService,
    AlertingService,
    PerformanceMonitoringService,
    PerformanceInsightsService,
  ],
})
export class ObservabilityModule {}
