import type { NextApiRequest, NextApiResponse } from 'next';

import type { WebVitalReport } from '@/lib/webVitalsReporter';

const MAX_REPORTS = 1000;

const reports: WebVitalReport[] = [];

export interface WebVitalsSummary {
  lcp: { good: number; needsImprovement: number; poor: number; avg: number; p75: number; p95: number };
  fid: { good: number; needsImprovement: number; poor: number; avg: number; p75: number; p95: number };
  cls: { good: number; needsImprovement: number; poor: number; avg: number; p75: number; p95: number };
  ttfb: { good: number; needsImprovement: number; poor: number; avg: number; p75: number; p95: number };
  inp: { good: number; needsImprovement: number; poor: number; avg: number; p75: number; p95: number };
  totalReports: number;
}

function getPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function computeMetricSummary(values: number[]): { good: number; needsImprovement: number; poor: number; avg: number; p75: number; p95: number } {
  const good = values.filter((v) => v <= 0).length;
  const needsImprovement = 0;
  const poor = 0;
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
  };

  for (const r of reports) {
    const vals = byMetric[r.metric.name];
    if (vals) {
      vals.push(r.metric.value);
    }
  }

  const summary = {} as WebVitalsSummary;
  for (const [key, vals] of Object.entries(byMetric)) {
    const s = computeMetricSummary(vals);
    (summary as any)[key.toLowerCase()] = s;
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
      return res.status(200).json({ summary, reports: reports.slice(-50) });
    }

    case 'DELETE': {
      reports.length = 0;
      return res.status(200).json({ ok: true });
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
