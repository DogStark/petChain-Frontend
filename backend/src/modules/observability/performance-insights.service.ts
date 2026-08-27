import { Injectable } from '@nestjs/common';
import {
  HistogramSample,
  MetricSample,
  MetricsService,
} from './metrics.service';

interface RouteAccumulator {
  method: string;
  route: string;
  requestCount: number;
  errorCount: number;
  latencySum: number;
  latencyCount: number;
  p95LatencyMs: number;
}

export interface Bottleneck {
  category: 'cpu' | 'memory' | 'latency' | 'errors' | 'event-loop';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  recommendation: string;
}

@Injectable()
export class PerformanceInsightsService {
  constructor(private readonly metrics: MetricsService) {}

  getSummary() {
    const requestSamples = this.metrics.getCounterSamples(
      'http_requests_total',
    );
    const errorSamples = this.metrics.getCounterSamples('http_errors_total');
    const latencySamples = this.metrics.getHistogramSamples(
      'http_request_duration_ms',
    );
    const routeMap = new Map<string, RouteAccumulator>();

    this.aggregateCounters(requestSamples, routeMap, 'requestCount');
    this.aggregateCounters(errorSamples, routeMap, 'errorCount');
    this.aggregateLatency(latencySamples, routeMap);

    const routes = Array.from(routeMap.values()).map((route) => ({
      ...route,
      averageLatencyMs:
        route.latencyCount > 0 ? route.latencySum / route.latencyCount : 0,
      errorRate:
        route.requestCount > 0 ? route.errorCount / route.requestCount : 0,
    }));

    const totalRequests = routes.reduce(
      (sum, route) => sum + route.requestCount,
      0,
    );
    const totalErrors = routes.reduce(
      (sum, route) => sum + route.errorCount,
      0,
    );
    const totalLatencySum = routes.reduce(
      (sum, route) => sum + route.latencySum,
      0,
    );
    const totalLatencyCount = routes.reduce(
      (sum, route) => sum + route.latencyCount,
      0,
    );

    const system = {
      cpuUsagePercent: this.metrics.getGaugeValue('process_cpu_usage_percent'),
      eventLoopLagMs: this.metrics.getGaugeValue('process_event_loop_lag_ms'),
      uptimeSeconds: this.metrics.getGaugeValue('process_uptime_seconds'),
      activeRequests: this.metrics.getGaugeValue('http_active_requests'),
      memory: {
        rssBytes: this.metrics.getGaugeValue('process_resident_memory_bytes'),
        heapUsedBytes: this.metrics.getGaugeValue('process_heap_used_bytes'),
        heapTotalBytes: this.metrics.getGaugeValue('process_heap_total_bytes'),
        heapUtilizationRatio: this.metrics.getGaugeValue(
          'process_heap_utilization_ratio',
        ),
      },
    };

    const http = {
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      averageLatencyMs:
        totalLatencyCount > 0 ? totalLatencySum / totalLatencyCount : 0,
      busiestRoutes: [...routes]
        .sort((left, right) => right.requestCount - left.requestCount)
        .slice(0, 5),
      slowestRoutes: [...routes]
        .sort((left, right) => right.p95LatencyMs - left.p95LatencyMs)
        .slice(0, 5),
      highestErrorRoutes: [...routes]
        .filter((route) => route.errorCount > 0)
        .sort((left, right) => right.errorRate - left.errorRate)
        .slice(0, 5),
    };

    return {
      generatedAt: new Date().toISOString(),
      system,
      http,
      bottlenecks: this.buildBottlenecks(system, http),
    };
  }

  private aggregateCounters(
    samples: MetricSample[],
    routeMap: Map<string, RouteAccumulator>,
    field: 'requestCount' | 'errorCount',
  ): void {
    for (const sample of samples) {
      const method = sample.labels.method ?? 'UNKNOWN';
      const route = sample.labels.route ?? 'unknown';
      const routeKey = `${method}:${route}`;
      const existing = routeMap.get(routeKey) ?? {
        method,
        route,
        requestCount: 0,
        errorCount: 0,
        latencySum: 0,
        latencyCount: 0,
        p95LatencyMs: 0,
      };

      existing[field] += sample.value;
      routeMap.set(routeKey, existing);
    }
  }

  private aggregateLatency(
    samples: HistogramSample[],
    routeMap: Map<string, RouteAccumulator>,
  ): void {
    for (const sample of samples) {
      const method = sample.labels.method ?? 'UNKNOWN';
      const route = sample.labels.route ?? 'unknown';
      const routeKey = `${method}:${route}`;
      const existing = routeMap.get(routeKey) ?? {
        method,
        route,
        requestCount: 0,
        errorCount: 0,
        latencySum: 0,
        latencyCount: 0,
        p95LatencyMs: 0,
      };

      existing.latencySum += sample.sum;
      existing.latencyCount += sample.total;
      existing.p95LatencyMs = Math.max(existing.p95LatencyMs, sample.p95);
      routeMap.set(routeKey, existing);
    }
  }

  private buildBottlenecks(
    system: {
      cpuUsagePercent: number;
      eventLoopLagMs: number;
      memory: { heapUtilizationRatio: number };
    },
    http: {
      errorRate: number;
      slowestRoutes: Array<{
        method: string;
        route: string;
        p95LatencyMs: number;
      }>;
    },
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const slowestRoute = http.slowestRoutes[0];

    if (system.cpuUsagePercent >= 80) {
      bottlenecks.push({
        category: 'cpu',
        severity: 'warning',
        title: 'High CPU usage',
        message: `CPU usage is ${system.cpuUsagePercent.toFixed(1)}%.`,
        recommendation:
          'Reduce synchronous work, batch heavy jobs, or scale horizontally.',
      });
    }

    if (system.memory.heapUtilizationRatio >= 0.85) {
      bottlenecks.push({
        category: 'memory',
        severity: 'critical',
        title: 'High heap pressure',
        message: `Heap utilization reached ${(system.memory.heapUtilizationRatio * 100).toFixed(1)}%.`,
        recommendation:
          'Inspect object retention, large responses, and cache sizes.',
      });
    }

    if (system.eventLoopLagMs >= 250) {
      bottlenecks.push({
        category: 'event-loop',
        severity: 'warning',
        title: 'Event loop lag is elevated',
        message: `Average event loop lag is ${system.eventLoopLagMs.toFixed(1)} ms.`,
        recommendation:
          'Move CPU-heavy work off the request path and reduce blocking operations.',
      });
    }

    if (http.errorRate >= 0.05) {
      bottlenecks.push({
        category: 'errors',
        severity: 'critical',
        title: 'HTTP error rate is elevated',
        message: `Observed error rate is ${(http.errorRate * 100).toFixed(1)}%.`,
        recommendation:
          'Inspect failing routes, dependency timeouts, and retry storms.',
      });
    }

    if (slowestRoute && slowestRoute.p95LatencyMs >= 1000) {
      bottlenecks.push({
        category: 'latency',
        severity: 'warning',
        title: 'Slow route detected',
        message: `${slowestRoute.method} ${slowestRoute.route} has p95 latency of ${slowestRoute.p95LatencyMs.toFixed(0)} ms.`,
        recommendation:
          'Profile this route, add caching for repeated reads, and reduce payload size.',
      });
    }

    return bottlenecks;
  }
}
