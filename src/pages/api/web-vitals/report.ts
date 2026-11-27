import type { NextApiRequest, NextApiResponse } from 'next';

import { getRating, type WebVitalReport } from '@/lib/webVitalsReporter';

const MAX_REPORTS = 1000;

const reports: WebVitalReport[] = [];

export interface MetricSummary {
  good: number;
  needsImprovement: number;
  poor: number;
  avg: number;
  p75: number;
  p95: number;
}

export interface WebVitalsSummary {
  lcp: MetricSummary;
  fid: MetricSummary;
  cls: MetricSummary;
  ttfb: MetricSummary;
  inp: MetricSummary;
  fcp: MetricSummary;
  totalReports: number;
}

function getPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function computeMetricSummary(values: number[], metricName: string): MetricSummary {
  let good = 0;
  let needsImprovement = 0;
  let poor = 0;
  for (const v of values) {
    const rating = getRating(v, metricName);
    if (rating === 'good') good += 1;
    else if (rating === 'needs-improvement') needsImprovement += 1;
    else poor += 1;
  }
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const sorted = [...values].sort((a, b) => a - b);
  const p75 = getPercentile(sorted, 75);
  const p95 = getPercentile(sorted, 95);
  return { good, needsImprovement, poor, avg, p75, p95 };
}

export function getSummary(): WebVitalsSummary {
  const byMetric: Record<string, number[]> = {
    LCP: [],
    FID: [],
    CLS: [],
    TTFB: [],
    INP: [],
    FCP: [],
  };

  for (const r of reports) {
    const vals = byMetric[r.metric.name];
    if (vals) {
      vals.push(r.metric.value);
    }
  }

  const summary = {} as WebVitalsSummary;
  for (const [key, vals] of Object.entries(byMetric)) {
    const s = computeMetricSummary(vals, key);
    const metricKey = key.toLowerCase() as keyof Omit<WebVitalsSummary, 'totalReports'>;
    summary[metricKey] = s;
  }
  summary.totalReports = reports.length;

  return summary;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'POST': {
      const report = req.body as WebVitalReport;
      if (!report?.metric?.name || report.metric.value === undefined) {
        return res.status(400).json({ error: 'Invalid report payload' });
      }
      reports.push(report);
      if (reports.length > MAX_REPORTS) {
        reports.splice(0, reports.length - MAX_REPORTS);
      }
      return res.status(201).json({ ok: true });
    }

    case 'GET': {
      const summary = getSummary();
      return res.status(200).json({ summary, reports: reports.slice(-200) });
    }

    case 'DELETE': {
      reports.length = 0;
      return res.status(200).json({ ok: true });
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
