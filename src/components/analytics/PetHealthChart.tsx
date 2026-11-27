import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PetHealthRecord {
  id: string;
  title: string;
  date?: string;
  petName?: string;
}

export interface HealthScorePoint {
  /** ISO date (YYYY-MM-DD) of the measurement. */
  date: string;
  /** Health score in the 0-100 range. */
  score: number;
}

export type HealthTrendDirection = 'up' | 'down' | 'stable';

export interface PetHealthTrend {
  petId: string;
  petName: string;
  /** Last 30 days of scores, oldest first. */
  history: HealthScorePoint[];
  direction: HealthTrendDirection;
  /** Difference between the latest and the earliest score in the window. */
  delta: number;
}

const TREND_THRESHOLD = 2;

/** Keeps only points from the last `days` days, oldest first. */
export function getRecentHealthHistory(
  history: HealthScorePoint[],
  days = 30,
  now: Date = new Date(),
): HealthScorePoint[] {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return history
    .filter((point) => {
      const time = new Date(point.date).getTime();
      return !Number.isNaN(time) && time >= cutoff.getTime() && time <= now.getTime();
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getTrendDirection(history: HealthScorePoint[]): {
  direction: HealthTrendDirection;
  delta: number;
} {
  if (history.length < 2) return { direction: 'stable', delta: 0 };
  const delta = history[history.length - 1].score - history[0].score;
  if (delta > TREND_THRESHOLD) return { direction: 'up', delta };
  if (delta < -TREND_THRESHOLD) return { direction: 'down', delta };
  return { direction: 'stable', delta };
}

export function buildPetHealthTrend(
  petId: string,
  petName: string,
  history: HealthScorePoint[],
  now: Date = new Date(),
): PetHealthTrend {
  const recent = getRecentHealthHistory(history, 30, now);
  const { direction, delta } = getTrendDirection(recent);
  return { petId, petName, history: recent, direction, delta };
}

const TREND_META: Record<HealthTrendDirection, { label: string; symbol: string; className: string }> = {
  up: { label: 'Improving', symbol: '▲', className: 'text-green-600' },
  down: { label: 'Declining', symbol: '▼', className: 'text-red-600' },
  stable: { label: 'Stable', symbol: '▬', className: 'text-gray-500' },
};

interface HealthSparklineProps {
  trend: PetHealthTrend;
  width?: number;
  height?: number;
}

/**
 * Accessible per-pet health score sparkline with trend indicator and tooltip.
 * Rendered as inline SVG so it works without a charting library and exposes
 * the score history to assistive technology via a text description.
 */
export const HealthSparkline: React.FC<HealthSparklineProps> = ({ trend, width = 160, height = 40 }) => {
  const { history, direction, delta, petName } = trend;
  const meta = TREND_META[direction];
  const scores = history.map((point) => point.score);
  const min = scores.length ? Math.min(...scores) : 0;
  const max = scores.length ? Math.max(...scores) : 100;
  const range = max - min || 1;
  const step = history.length > 1 ? width / (history.length - 1) : width;

  const points = history
    .map((point, index) => {
      const x = history.length > 1 ? index * step : width / 2;
      const y = height - ((point.score - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const latest = history[history.length - 1];
  const summary = history.length
    ? `${petName} health score trend: ${meta.label} (${delta > 0 ? '+' : ''}${delta} points over the last 30 days). Latest score ${latest.score} on ${latest.date}.`
    : `${petName} has no health score history in the last 30 days.`;

  return (
    <div className="flex items-center gap-3" data-testid={`health-sparkline-${trend.petId}`}>
      <div className="relative group">
        <svg
          role="img"
          aria-label={summary}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
        >
          <title>{summary}</title>
          {history.length > 1 && (
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={meta.className}
            />
          )}
          {history.map((point, index) => {
            const x = history.length > 1 ? index * step : width / 2;
            const y = height - ((point.score - min) / range) * height;
            return (
              <circle key={`${point.date}-${index}`} cx={x} cy={y} r={2} className={meta.className} fill="currentColor">
                <title>{`${point.date}: ${point.score}`}</title>
              </circle>
            );
          })}
        </svg>
        <div
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-48 rounded-lg bg-slate-900 p-2 text-xs text-white shadow-lg group-hover:block group-focus-within:block"
        >
          {history.length ? (
            <ul className="space-y-0.5">
              {history.map((point) => (
                <li key={point.date} className="flex justify-between gap-2">
                  <span>{point.date}</span>
                  <span>{point.score}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span>No scores in the last 30 days</span>
          )}
        </div>
      </div>
      <span className={`text-sm font-medium ${meta.className}`} aria-hidden="true">
        {meta.symbol} {meta.label}
      </span>
    </div>
  );
};

interface PetHealthChartProps {
  data: {
    name: string;
    value: number;
    color: string;
  }[];
  drilldownEndpoint?: string;
  fetchImpl?: typeof fetch;
}

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

const renderCustomizedLabel = (props: PieLabelProps) => {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius = 0,
    outerRadius = 0,
    percent = 0,
  } = props;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const PetHealthChart: React.FC<PetHealthChartProps> = ({
  data,
  drilldownEndpoint = '/api/analytics/pet-health-records',
  fetchImpl = fetch,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [records, setRecords] = useState<PetHealthRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const selectedEntry = useMemo(
    () => data.find((entry) => entry.name === selectedStatus) ?? null,
    [data, selectedStatus],
  );

  useEffect(() => {
    if (!selectedStatus) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedStatus(null);
        setError(null);
        setEmpty(false);
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [selectedStatus]);

  useEffect(() => {
    if (!selectedStatus || !dialogRef.current) return;
    dialogRef.current.focus();
  }, [selectedStatus]);

  const openDrilldown = async (status: string) => {
    const entry = data.find((item) => item.name === status);
    if (!entry) return;

    setSelectedStatus(status);
    setRecords([]);
    setError(null);
    setEmpty(false);
    setLoading(true);

    try {
      const params = new URLSearchParams({ status });
      const response = await fetchImpl(`${drilldownEndpoint}?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string; denied?: boolean };
        const message = payload.message || payload.error || 'Record-level consent is required to view these records.';
        setError(message);
        setRecords([]);
        setEmpty(false);
        return;
      }

      const payload = (await response.json().catch(() => ({ records: [] }))) as {
        records?: PetHealthRecord[];
      };
      const nextRecords = Array.isArray(payload.records) ? payload.records : [];
      setRecords(nextRecords);
      setEmpty(nextRecords.length === 0);
    } catch {
      setError('Unable to load authorized records. Please try again.');
      setRecords([]);
      setEmpty(false);
    } finally {
      setLoading(false);
    }
  };

  const closeDialog = () => {
    setSelectedStatus(null);
    setError(null);
    setEmpty(false);
    setRecords([]);
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
      <h3 className="text-lg font-bold mb-4 text-blue-700">Pet Health Distribution</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              onClick={(entry: { name?: string; value?: number } | undefined) => {
                if (!entry?.name || typeof entry.value !== 'number') return;
                void openDrilldown(entry.name);
              }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  cursor="pointer"
                  aria-label={`Open authorized ${entry.name} records`}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend layout="vertical" verticalAlign="middle" align="right" />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-col gap-2" aria-label="Health record drill down actions">
        {data.map((entry) => (
          <button
            key={entry.name}
            type="button"
            onClick={() => void openDrilldown(entry.name)}
            disabled={loading}
            aria-label={`Open authorized ${entry.name} records`}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 transition hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {entry.name} · {entry.value} record{entry.value === 1 ? '' : 's'}
          </button>
        ))}
      </div>

      {selectedStatus && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pet-health-drilldown-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl outline-none"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h4 id="pet-health-drilldown-title" className="text-lg font-semibold text-gray-900">
                {selectedEntry?.name ?? 'Authorized'} records
              </h4>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close records dialog"
              >
                Close
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {loading && <p className="text-sm text-gray-600">Loading authorized records…</p>}

              {!loading && error && (
                <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              {!loading && !error && empty && (
                <p className="text-sm text-gray-700">
                  No authorized records are available for this aggregate view.
                </p>
              )}

              {!loading && !error && !empty && records.length > 0 && (
                <ul className="space-y-3" aria-label={`${selectedEntry?.name ?? 'Selected'} authorized records`}>
                  {records.map((record) => (
                    <li key={record.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="font-medium text-gray-900">{record.title}</h5>
                        {record.date && (
                          <span className="text-xs text-gray-500">{record.date}</span>
                        )}
                      </div>
                      {record.petName && (
                        <p className="mt-1 text-sm text-gray-600">Pet: {record.petName}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PetHealthChart;
