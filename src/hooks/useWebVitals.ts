import { useEffect, useRef, useState } from 'react';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

import {
  buildReport,
  getRating,
  sendToAnalytics,
  sendToGoogleAnalytics,
  type WebVitalMetric,
  type WebVitalReport,
} from '@/lib/webVitalsReporter';

export interface WebVitalsState {
  reports: WebVitalReport[];
  latestMetrics: Record<string, WebVitalMetric>;
}

function toWebVitalMetric(name: string, value: number, id: string, navigationType: string, rating?: string): WebVitalMetric {
  return {
    name,
    value,
    rating: (rating as WebVitalMetric['rating']) || getRating(value, name),
    delta: value,
    id,
    navigationType,
  };
}

export function useWebVitals(reportToAnalytics = true) {
  const [state, setState] = useState<WebVitalsState>({ reports: [], latestMetrics: {} });
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;

    const handleMetric = (name: string) => (metric: any) => {
      const m = toWebVitalMetric(name, metric.value, metric.id, metric.navigationType, metric.rating);

      const report = buildReport(m);

      setState((prev) => ({
        reports: [...prev.reports, report],
        latestMetrics: { ...prev.latestMetrics, [name]: m },
      }));

      if (reportToAnalytics) {
        sendToAnalytics(report);
        sendToGoogleAnalytics(report);
      }
    };

    onLCP(handleMetric('LCP'));
    onFIDPolyfill(handleMetric('FID'));
    onCLS(handleMetric('CLS'));
    onTTFB(handleMetric('TTFB'));
    onINP(handleMetric('INP'));
    onFCP(handleMetric('FCP'));
  }, [reportToAnalytics]);

  return state;
}

function onFIDPolyfill(callback: (metric: { value: number; id: string; navigationType: string; rating?: string }) => void) {
  if (typeof window === 'undefined') return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEventTiming;
        callback({
          value: e.processingStart - e.startTime,
          id: `${e.startTime}-${e.duration}`,
          navigationType: 'navigate',
          rating: undefined,
        });
      }
    });
    observer.observe({ type: 'first-input', buffered: true });
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Web Vitals] FID not supported');
    }
  }
}

export function useWebVitalsSummary(refreshInterval = 0) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/web-vitals/report');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary(data.summary || data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    if (refreshInterval > 0) {
      const id = setInterval(fetchSummary, refreshInterval);
      return () => clearInterval(id);
    }
  }, [refreshInterval]);

  return { summary, loading, error, refetch: fetchSummary };
}
