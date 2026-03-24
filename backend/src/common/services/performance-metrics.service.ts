import { Injectable, Logger } from '@nestjs/common';

interface MetricData {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

@Injectable()
export class PerformanceMetricsService {
  private readonly logger = new Logger(PerformanceMetricsService.name);
  private metrics: Map<string, MetricData> = new Map();
  private readonly flushInterval = 60000; // 1 minute

  constructor() {
    this.startFlushInterval();
  }

  recordMetric(name: string, value: number): void {
    const existing = this.metrics.get(name) || {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      avg: 0,
    };

    existing.count++;
    existing.sum += value;
    existing.min = Math.min(existing.min, value);
    existing.max = Math.max(existing.max, value);
    existing.avg = existing.sum / existing.count;

    this.metrics.set(name, existing);
  }

  getMetric(name: string): MetricData | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): Record<string, MetricData> {
    const result: Record<string, MetricData> = {};
    this.metrics.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  resetMetrics(): void {
    this.metrics.clear();
  }

  private startFlushInterval(): void {
    setInterval(() => {
      const metrics = this.getAllMetrics();
      if (Object.keys(metrics).length > 0) {
        this.logger.log('Performance Metrics:', JSON.stringify(metrics, null, 2));
      }
    }, this.flushInterval);
  }
}
