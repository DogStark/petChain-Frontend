import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { MetricsService } from './metrics.service';

@Injectable()
export class PerformanceMonitoringService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  private previousCpuUsage = process.cpuUsage();
  private previousSampleTime = process.hrtime.bigint();

  constructor(private readonly metrics: MetricsService) {}

  onModuleInit(): void {
    this.eventLoopDelay.enable();
    this.collect();
  }

  onModuleDestroy(): void {
    this.eventLoopDelay.disable();
  }

  @Interval(15000)
  collect(): void {
    const memoryUsage = process.memoryUsage();
    const now = process.hrtime.bigint();
    const elapsedMs = Number(now - this.previousSampleTime) / 1_000_000;
    const cpuUsage = process.cpuUsage(this.previousCpuUsage);
    const cpuPercent =
      elapsedMs > 0
        ? ((cpuUsage.user + cpuUsage.system) / 1000 / elapsedMs) * 100
        : 0;

    this.metrics.set('process_resident_memory_bytes', memoryUsage.rss);
    this.metrics.set('process_heap_used_bytes', memoryUsage.heapUsed);
    this.metrics.set('process_heap_total_bytes', memoryUsage.heapTotal);
    this.metrics.set('process_external_memory_bytes', memoryUsage.external);
    this.metrics.set(
      'process_heap_utilization_ratio',
      memoryUsage.heapTotal > 0
        ? memoryUsage.heapUsed / memoryUsage.heapTotal
        : 0,
    );
    this.metrics.set(
      'process_cpu_usage_percent',
      Number(cpuPercent.toFixed(2)),
    );
    this.metrics.set(
      'process_event_loop_lag_ms',
      Number((this.eventLoopDelay.mean / 1_000_000).toFixed(2)),
    );
    this.metrics.set(
      'process_uptime_seconds',
      Number(process.uptime().toFixed(2)),
    );

    this.previousCpuUsage = process.cpuUsage();
    this.previousSampleTime = now;
    this.eventLoopDelay.reset();
  }
}
