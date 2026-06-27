'use client';

import { useEffect, useState } from 'react';

interface Alert { name: string; severity: string; message: string; firedAt: string }
interface PerformanceStatus {
  system?: {
    cpuUsagePercent: number;
    eventLoopLagMs: number;
    memory: { heapUtilizationRatio: number };
  };
  http?: {
    totalRequests: number;
    errorRate: number;
    averageLatencyMs: number;
  };
}

interface Status {
  health: { status: string; timestamp: string };
  alerts: Alert[];
  performance?: PerformanceStatus;
}

export default function ObservabilityStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      setError(null);
      fetch('/api/observability/status')
        .then((r) => r.json())
        .then((data) => { if (active) setStatus(data); })
        .catch((e) => { if (active) setError(e.message); });
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (!status && !error) return <div className="text-sm text-gray-400">Loading…</div>;

  const isError = !!error;
  const isUp = !isError && status?.health?.status === 'ok';
  const performance = status?.performance;

  const badge = (() => {
    if (isError) return { bg: 'bg-yellow-50 dark:bg-yellow-900/20', dot: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-300', label: 'Status Unknown' };
    return {
      bg: isUp ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20',
      dot: isUp ? 'bg-green-500' : 'bg-red-500',
      text: isUp ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300',
      label: `Backend ${isUp ? 'Healthy' : 'Degraded'}`,
    };
  })();

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 rounded-lg px-4 py-3 ${badge.bg}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${badge.dot}`} />
        <span className={`text-sm font-medium ${badge.text}`}>
          {badge.label}
        </span>
        <span className="ml-auto text-xs text-gray-400">
          {status?.health?.timestamp ? new Date(status.health.timestamp).toLocaleTimeString() : ''}
        </span>
      </div>

      {!isError && status?.alerts?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Active Alerts</p>
          {status.alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm ${a.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'}`}
            >
              <span className="font-medium">{a.name}</span> — {a.message}
            </div>
          ))}
        </div>
      )}

      {!isError && performance?.http && performance?.system && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Avg Latency"
            value={`${performance.http.averageLatencyMs.toFixed(0)} ms`}
          />
          <MetricCard
            label="Error Rate"
            value={`${(performance.http.errorRate * 100).toFixed(1)}%`}
          />
          <MetricCard
            label="CPU"
            value={`${performance.system.cpuUsagePercent.toFixed(1)}%`}
          />
          <MetricCard
            label="Heap Utilization"
            value={`${(performance.system.memory.heapUtilizationRatio * 100).toFixed(1)}%`}
          />
        </div>
      )}

      <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
        <a href={process.env.NEXT_PUBLIC_GRAFANA_URL ?? 'http://localhost:3001'} target="_blank" rel="noreferrer" className="hover:underline">Grafana →</a>
        <a href={process.env.NEXT_PUBLIC_KIBANA_URL ?? 'http://localhost:5601'} target="_blank" rel="noreferrer" className="hover:underline">Kibana →</a>
        <a href={process.env.NEXT_PUBLIC_PROMETHEUS_URL ?? 'http://localhost:9090'} target="_blank" rel="noreferrer" className="hover:underline">Prometheus →</a>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
