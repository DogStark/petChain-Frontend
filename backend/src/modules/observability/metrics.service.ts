import { Injectable } from '@nestjs/common';

/**
 * Prometheus-compatible metrics registry.
 * Exposes a /metrics endpoint in Prometheus text format.
 * No native addon required — pure TypeScript counters/histograms/gauges.
 */
@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, { value: number; labels: string }>();
  private readonly gauges = new Map<string, { value: number; labels: string }>();
  // histogram: bucket boundaries → counts
  private readonly histograms = new Map<
    string,
    { buckets: number[]; counts: number[]; sum: number; total: number; labels: string }
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

  // ── Histogram ─────────────────────────────────────────────────────────────

  observe(name: string, value: number, labels = '', buckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500]): void {
    const key = `${name}{${labels}}`;
    let h = this.histograms.get(key);
    if (!h) {
      h = { buckets, counts: new Array(buckets.length).fill(0), sum: 0, total: 0, labels };
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
}
