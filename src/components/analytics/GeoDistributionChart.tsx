import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface GeoDistributionPoint {
  region: string;
  users: number;
  pets?: number;
  /** ISO 3166-1 alpha-2 country code, when the backend provides one. */
  countryCode?: string;
}

export interface GeoDistributionChartProps {
  data: GeoDistributionPoint[];
  /** Optional date-range filter; when provided the chart renders range inputs. */
  dateRange?: { startDate: string; endDate: string };
  onDateRangeChange?: (range: { startDate: string; endDate: string }) => void;
  /** True while a filtered fetch is in flight. */
  loading?: boolean;
}

const GeoDistributionChart: React.FC<GeoDistributionChartProps> = ({
  data,
  dateRange,
  onDateRangeChange,
  loading = false,
}) => {
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  const totalUsers = useMemo(() => data.reduce((sum, entry) => sum + entry.users, 0), [data]);
  const activeEntry = useMemo(
    () => data.find((entry) => entry.region === activeRegion) ?? null,
    [data, activeRegion],
  );

  const showFilter = Boolean(dateRange && onDateRangeChange);

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
      <h3 className="text-lg font-bold mb-4 text-blue-700">Geographic Usage Patterns</h3>

      {showFilter && dateRange && onDateRangeChange && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs font-semibold text-gray-700">
            From
            <input
              type="date"
              value={dateRange.startDate}
              max={dateRange.endDate || undefined}
              onChange={(event) =>
                onDateRangeChange({ ...dateRange, startDate: event.target.value })
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            To
            <input
              type="date"
              value={dateRange.endDate}
              min={dateRange.startDate || undefined}
              onChange={(event) =>
                onDateRangeChange({ ...dateRange, endDate: event.target.value })
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-sm"
            />
          </label>
          {loading && (
            <span role="status" className="text-xs text-gray-600 sm:pb-2">
              Updating…
            </span>
          )}
        </div>
      )}

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            onMouseMove={(state) => {
              const label = state?.activeLabel;
              setActiveRegion(typeof label === 'string' ? label : null);
            }}
            onMouseLeave={() => setActiveRegion(null)}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" stroke="#9ca3af" />
            <YAxis dataKey="region" type="category" width={100} stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value: number, name: string) => [value.toLocaleString(), name]}
            />
            <Legend />
            <Bar dataKey="users" name="Active Users" fill="#8884d8" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-sm text-gray-700" aria-live="polite">
        {activeEntry
          ? `${activeEntry.region}: ${activeEntry.users.toLocaleString()} users${
              typeof activeEntry.pets === 'number'
                ? `, ${activeEntry.pets.toLocaleString()} pets`
                : ''
            }`
          : `${totalUsers.toLocaleString()} users across ${data.length} region${
              data.length === 1 ? '' : 's'
            }`}
      </p>
    </div>
  );
};

export default GeoDistributionChart;
