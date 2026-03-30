import { Injectable } from '@nestjs/common';

export interface MetricSample {
  name: string;
  labels: Record<string, string>;
  rawLabels: string;
  value: number;
}

export interface HistogramSample {
  name: string;
  labels: Record<string, string>;
  rawLabels: string;
  buckets: number[];
  counts: number[];
  sum: number;
  total: number;
  average: number;
  p95: number;
}

/**
 * Prometheus-compatible metrics registry.
 * Exposes a /metrics endpoint in Prometheus text format.
 * No native addon required — pure TypeScript counters/histograms/gauges.
 */
@Injectable()
export class MetricsService {
  private readonly counters = new Map<
    string,
    { value: number; labels: string }
  >();
  private readonly gauges = new Map<
    string,
    { value: number; labels: string }
  >();
  // histogram: bucket boundaries → counts
  private readonly histograms = new Map<
    string,
    {
      buckets: number[];
      counts: number[];
      sum: number;
      total: number;
      labels: string;
    }
  >();

  // ── Counter ────────────────────────────────────────────────────────────────

  inc(name: string, labels = '', amount = 1): void {
    const key = `${name}{${labels}}`;
    const existing = this.counters.get(key);
    this.counters.set(key, { value: (existing?.value ?? 0) + amount, labels });
  }

  // ── Gauge ──────────────────────────────────────────────────────────────────

  set(name: string, value: number, labels = ''): void {
    this.gauges.set(`${name}{${labels}}`, { value, labels });
  }

  changeGauge(name: string, delta: number, labels = ''): void {
    const currentValue = this.getGaugeValue(name, labels);
    const nextValue = currentValue + delta;
    this.set(name, nextValue < 0 ? 0 : nextValue, labels);
  }

  getGaugeValue(name: string, labels = ''): number {
    return this.gauges.get(`${name}{${labels}}`)?.value ?? 0;
  }

  // ── Histogram ─────────────────────────────────────────────────────────────

  observe(
    name: string,
    value: number,
    labels = '',
    buckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  ): void {
    const key = `${name}{${labels}}`;
    let h = this.histograms.get(key);
    if (!h) {
      h = {
        buckets,
        counts: new Array(buckets.length).fill(0),
        sum: 0,
        total: 0,
        labels,
      };
      this.histograms.set(key, h);
    }
    h.sum += value;
    h.total++;
    for (let i = 0; i < buckets.length; i++) {
      if (value <= buckets[i]) h.counts[i]++;
    }
  }

  // ── Prometheus text format ─────────────────────────────────────────────────

  render(): string {
    const lines: string[] = [];

    for (const [key, { value }] of this.counters) {
      const name = key.split('{')[0];
      lines.push(`# TYPE ${name} counter`, `${key} ${value}`);
    }

    for (const [key, { value }] of this.gauges) {
      const name = key.split('{')[0];
      lines.push(`# TYPE ${name} gauge`, `${key} ${value}`);
    }

    for (const [key, h] of this.histograms) {
      const name = key.split('{')[0];
      const lbl = h.labels ? `,${h.labels}` : '';
      lines.push(`# TYPE ${name} histogram`);
      for (let i = 0; i < h.buckets.length; i++) {
        lines.push(`${name}_bucket{le="${h.buckets[i]}"${lbl}} ${h.counts[i]}`);
      }
      lines.push(
        `${name}_bucket{le="+Inf"${lbl}} ${h.total}`,
        `${name}_sum${lbl ? `{${h.labels}}` : ''} ${h.sum}`,
        `${name}_count${lbl ? `{${h.labels}}` : ''} ${h.total}`,
      );
    }

    return lines.join('\n') + '\n';
  }

  getCounterSamples(name?: string): MetricSample[] {
    return Array.from(this.counters.entries())
      .map(([key, { value, labels }]) => ({
        name: this.metricNameFromKey(key),
        labels: this.parseLabels(labels),
        rawLabels: labels,
        value,
      }))
      .filter((sample) => (name ? sample.name === name : true));
  }

  getGaugeSamples(name?: string): MetricSample[] {
    return Array.from(this.gauges.entries())
      .map(([key, { value, labels }]) => ({
        name: this.metricNameFromKey(key),
        labels: this.parseLabels(labels),
        rawLabels: labels,
        value,
      }))
      .filter((sample) => (name ? sample.name === name : true));
  }

  getHistogramSamples(name?: string): HistogramSample[] {
    return Array.from(this.histograms.entries())
      .map(([key, histogram]) => ({
        name: this.metricNameFromKey(key),
        labels: this.parseLabels(histogram.labels),
        rawLabels: histogram.labels,
        buckets: [...histogram.buckets],
        counts: [...histogram.counts],
        sum: histogram.sum,
        total: histogram.total,
        average: histogram.total > 0 ? histogram.sum / histogram.total : 0,
        p95: this.estimateQuantile(
          histogram.buckets,
          histogram.counts,
          histogram.total,
          0.95,
        ),
      }))
      .filter((sample) => (name ? sample.name === name : true));
  }

  private metricNameFromKey(key: string): string {
    return key.split('{')[0];
  }

  private parseLabels(labels: string): Record<string, string> {
    if (!labels.trim()) {
      return {};
    }

    const parsed: Record<string, string> = {};
    const matcher = /(\w+)="([^"]*)"/g;
    let match: RegExpExecArray | null;

    while ((match = matcher.exec(labels)) !== null) {
      parsed[match[1]] = match[2];
    }

    return parsed;
  }

  private estimateQuantile(
    buckets: number[],
    counts: number[],
    total: number,
    quantile: number,
  ): number {
    if (total === 0) {
      return 0;
    }

    const target = total * quantile;
    for (let index = 0; index < buckets.length; index += 1) {
      if (counts[index] >= target) {
        return buckets[index];
      }
    }

    return buckets[buckets.length - 1] ?? 0;
  }
}
