import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { EngagementTrendPoint, FeatureUsage } from '@/lib/api/analyticsAPI';

export interface UserEngagementChartProps {
  data: EngagementTrendPoint[];
  featureUsage?: FeatureUsage[];
  range?: string;
  onRangeChange?: (range: string) => void;
  rangeOptions?: Array<{ value: string; label: string }>;
}

const UserEngagementChart: React.FC<UserEngagementChartProps> = ({
  data,
  featureUsage = [],
  range,
  onRangeChange,
  rangeOptions = [],
}) => {
  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-blue-700">User Engagement</h3>
        {onRangeChange && rangeOptions.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span className="sr-only">Date range</span>
            <select
              aria-label="Date range"
              value={range}
              onChange={(event) => onRangeChange(event.target.value)}
              className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="dau"
              name="Daily Active Users"
              stroke="#4f46e5"
              activeDot={{ r: 8 }}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="wau"
              name="Weekly Active Users"
              stroke="#10b981"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {featureUsage.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-sm font-semibold text-blue-700">Feature Usage Breakdown</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={featureUsage}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis dataKey="feature" type="category" width={110} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Bar dataKey="users" name="Users" fill="#8884d8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserEngagementChart;
