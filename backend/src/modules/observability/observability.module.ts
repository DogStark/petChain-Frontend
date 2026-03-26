import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { TracingService } from './tracing.service';
import { LogAggregatorService } from './log-aggregator.service';
import { AlertingService } from './alerting.service';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { ObservabilityController } from './observability.controller';

@Global()
@Module({
  controllers: [ObservabilityController],
  providers: [
    MetricsService,
    TracingService,
    LogAggregatorService,
    AlertingService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [MetricsService, TracingService, LogAggregatorService, AlertingService],
})
export class ObservabilityModule {}
