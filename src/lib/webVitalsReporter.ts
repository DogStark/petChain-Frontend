export interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

export interface WebVitalReport {
  metric: WebVitalMetric;
  page: string;
  timestamp: string;
  userAgent: string;
  connection?: string;
}

export interface PerformanceBudget {
  metric: 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'INP' | 'FCP';
  good: number;
  needsImprovement: number;
  poor: number;
}

export const PERFORMANCE_BUDGETS: PerformanceBudget[] = [
  { metric: 'LCP', good: 2500, needsImprovement: 4000, poor: Infinity },
  { metric: 'FID', good: 100, needsImprovement: 300, poor: Infinity },
  { metric: 'CLS', good: 0.1, needsImprovement: 0.25, poor: Infinity },
  { metric: 'TTFB', good: 800, needsImprovement: 1800, poor: Infinity },
  { metric: 'INP', good: 200, needsImprovement: 500, poor: Infinity },
  { metric: 'FCP', good: 1800, needsImprovement: 3000, poor: Infinity },
];

const API_ENDPOINT = '/api/web-vitals/report';

export function getRating(value: number, metricName: string): 'good' | 'needs-improvement' | 'poor' {
  const budget = PERFORMANCE_BUDGETS.find((b) => b.metric === metricName);
  if (!budget) return 'needs-improvement';

  if (value <= budget.good) return 'good';
  if (value <= budget.needsImprovement) return 'needs-improvement';
  return 'poor';
}

function getConnectionType(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const conn = (navigator as any)?.connection;
  return conn?.effectiveType;
}

function getPagePath(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname + window.location.search;
}

export function buildReport(metric: WebVitalMetric): WebVitalReport {
  return {
    metric,
    page: getPagePath(),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    connection: getConnectionType(),
  };
}

export async function sendToAnalytics(report: WebVitalReport): Promise<void> {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Web Vitals] ${report.metric.name}: ${report.metric.value} (${report.metric.rating})`);
      return;
    }

    const payload = JSON.stringify(report);
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(API_ENDPOINT, payload);
      if (!sent) {
        await fetch(API_ENDPOINT, { method: 'POST', body: payload, keepalive: true });
      }
    } else {
      await fetch(API_ENDPOINT, { method: 'POST', body: payload, keepalive: true });
    }
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Web Vitals] Failed to send report');
    }
  }
}

export async function sendToGoogleAnalytics(report: WebVitalReport): Promise<void> {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId || typeof window === 'undefined') return;

  try {
    const gtag = (window as any).gtag;
    if (gtag) {
      gtag('event', report.metric.name, {
        value: report.metric.value,
        metric_id: report.metric.id,
        metric_value: report.metric.value,
        metric_delta: report.metric.delta,
        metric_rating: report.metric.rating,
        page_location: report.page,
        metric_navigation_type: report.metric.navigationType,
        non_interaction: true,
      });
    }
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Web Vitals] Failed to send to GA');
    }
  }
}

export function checkBudget(metric: WebVitalMetric): boolean {
  const budget = PERFORMANCE_BUDGETS.find((b) => b.metric === metric.name);
  if (!budget) return true;
  return getRating(metric.value, metric.name) !== 'poor';
}

export function formatMetricValue(name: string, value: number): string {
  switch (name) {
    case 'CLS':
      return value.toFixed(3);
    case 'LCP':
    case 'FID':
    case 'TTFB':
    case 'INP':
    case 'FCP':
      return `${Math.round(value)} ms`;
    default:
      return String(value);
  }
}
