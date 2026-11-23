import React, { useMemo, useState } from 'react';
import {
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export type ApiUsageTimePeriod = '24h' | '7d' | '30d' | '90d';

export interface ApiEndpointUsage {
  endpoint: string;
  calls: number;
  errors: number;
}

export interface ApiUsageChartProps {
  data: ApiEndpointUsage[];
  period?: ApiUsageTimePeriod;
  onPeriodChange?: (period: ApiUsageTimePeriod) => void;
  /** Number of endpoints to display, ranked by call count. */
  topN?: number;
}

export const API_USAGE_PERIODS: { value: ApiUsageTimePeriod; label: string }[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const errorRate = (entry: ApiEndpointUsage): number =>
  entry.calls > 0 ? Number(((entry.errors / entry.calls) * 100).toFixed(2)) : 0;

const ApiUsageChart: React.FC<ApiUsageChartProps> = ({
  data,
  period = '7d',
  onPeriodChange,
  topN = 8,
}) => {
  const [internalPeriod, setInternalPeriod] = useState<ApiUsageTimePeriod>(period);
  const activePeriod = onPeriodChange ? period : internalPeriod;

  const handlePeriodChange = (next: ApiUsageTimePeriod) => {
    if (onPeriodChange) {
      onPeriodChange(next);
    } else {
      setInternalPeriod(next);
    }
  };

  const chartData = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.calls - a.calls)
        .slice(0, topN)
        .map((entry) => ({ ...entry, errorRate: errorRate(entry) })),
    [data, topN],
  );

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-blue-700">API Usage by Endpoint</h3>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <span>Time period</span>
          <select
            value={activePeriod}
            onChange={(event) => handlePeriodChange(event.target.value as ApiUsageTimePeriod)}
            className="rounded-lg border border-blue-100 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
          >
            {API_USAGE_PERIODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{
              top: 10,
              right: 30,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="endpoint" stroke="#9ca3af" interval={0} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="calls" stroke="#9ca3af" />
            <YAxis
              yAxisId="rate"
              orientation="right"
              unit="%"
              stroke="#9ca3af"
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value: number, name: string) =>
                name === 'Error rate' ? [`${value}%`, name] : [value, name]
              }
            />
            <Legend />
            <Bar yAxisId="calls" dataKey="calls" name="Calls" fill="#8884d8" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="errorRate"
              name="Error rate"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {chartData.length === 0 && (
        <p className="mt-3 text-sm text-gray-800">No API usage data available for this period.</p>
      )}
    </div>
  );
};

export default ApiUsageChart;
