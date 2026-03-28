'use client';

import { useEffect, useState } from 'react';

interface Alert { name: string; severity: string; message: string; firedAt: string }
interface Status { health: { status: string; timestamp: string }; alerts: Alert[] }

export default function ObservabilityStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch('/api/observability/status')
        .then((r) => r.json())
        .then(setStatus)
        .catch((e) => setError(e.message));
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (error) return <div className="text-sm text-red-500">Monitoring unavailable: {error}</div>;
  if (!status) return <div className="text-sm text-gray-400">Loading…</div>;

  const isUp = status.health?.status === 'ok';

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 rounded-lg px-4 py-3 ${isUp ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${isUp ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={`text-sm font-medium ${isUp ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
          Backend {isUp ? 'Healthy' : 'Degraded'}
        </span>
        <span className="ml-auto text-xs text-gray-400">
          {status.health?.timestamp ? new Date(status.health.timestamp).toLocaleTimeString() : ''}
        </span>
      </div>

      {status.alerts?.length > 0 && (
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

      <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
        <a href={process.env.NEXT_PUBLIC_GRAFANA_URL ?? 'http://localhost:3001'} target="_blank" rel="noreferrer" className="hover:underline">Grafana →</a>
        <a href={process.env.NEXT_PUBLIC_KIBANA_URL ?? 'http://localhost:5601'} target="_blank" rel="noreferrer" className="hover:underline">Kibana →</a>
        <a href={process.env.NEXT_PUBLIC_PROMETHEUS_URL ?? 'http://localhost:9090'} target="_blank" rel="noreferrer" className="hover:underline">Prometheus →</a>
      </div>
    </div>
  );
}
