import React, { useCallback, useEffect, useState } from 'react';

export type ServiceHealthStatus = 'up' | 'degraded' | 'down';

export interface ServiceHealth {
  id: string;
  name: string;
  status: ServiceHealthStatus;
  message?: string;
}

export interface HealthReport {
  services: ServiceHealth[];
  checkedAt: string;
}

const REFRESH_INTERVAL_MS = 30000;

const STATUS_LABEL: Record<ServiceHealthStatus, string> = {
  up: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
};

const STATUS_STYLES: Record<ServiceHealthStatus, string> = {
  up: 'bg-green-100 text-green-800 border-green-300',
  degraded: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  down: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_DOT: Record<ServiceHealthStatus, string> = {
  up: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
};

async function fetchHealthReport(): Promise<HealthReport> {
  const response = await fetch('/api/health', {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  const data = await response.json();
  const services: ServiceHealth[] = Array.isArray(data?.services)
    ? data.services.map((service: Partial<ServiceHealth>, index: number) => ({
        id: service.id ?? `service-${index}`,
        name: service.name ?? `Service ${index + 1}`,
        status:
          service.status === 'up' || service.status === 'degraded' || service.status === 'down'
            ? service.status
            : 'down',
        message: service.message,
      }))
    : [];

  return {
    services,
    checkedAt: data?.checkedAt ?? new Date().toISOString(),
  };
}

const ObservabilityStatus: React.FC = () => {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadHealth = useCallback(async () => {
    try {
      const nextReport = await fetchHealthReport();
      setReport(nextReport);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load service health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadHealth]);

  const lastChecked = report ? new Date(report.checkedAt) : null;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">System Status</h1>
        <button
          type="button"
          onClick={loadHealth}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <p className="mb-4 text-sm text-gray-500" aria-live="polite">
        {lastChecked
          ? `Last checked: ${lastChecked.toLocaleString()}`
          : 'Checking service health…'}
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {loading && !report ? (
        <p className="text-sm text-gray-500">Loading service health…</p>
      ) : (
        <ul className="space-y-3">
          {(report?.services ?? []).map((service) => (
            <li
              key={service.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
            >
              <div>
                <p className="font-medium text-gray-900">{service.name}</p>
                {service.message && (
                  <p className="text-sm text-gray-500">{service.message}</p>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[service.status]}`}
                aria-label={`${service.name} status: ${STATUS_LABEL[service.status]}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${STATUS_DOT[service.status]}`}
                  aria-hidden="true"
                />
                {STATUS_LABEL[service.status]}
              </span>
            </li>
          ))}
          {report && report.services.length === 0 && (
            <li className="text-sm text-gray-500">No services reported.</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default ObservabilityStatus;
