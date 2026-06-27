import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { LabResultItem } from '@/types/lab-results';

interface TrendsChartProps {
  data: LabResultItem[];
}

export default function TrendsChart({ data }: TrendsChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item) => {
      const numericValue =
        typeof item.value === 'string' ? parseFloat(item.value) || 0 : item.value;
      return {
        ...item,
        dateFormatted: new Date(item.date).toLocaleDateString(undefined, {
          month: 'short',
          year: '2-digit',
        }),
        fullDate: new Date(item.date).toLocaleDateString(),
        numericValue,
      };
    });
  }, [data]);

  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    const values = chartData.map((d) => d.numericValue);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.2 || max * 0.2 || 10;
    return [Math.max(0, min - padding), max + padding];
  }, [chartData]);

  const refRange = useMemo(() => chartData[0]?.referenceRange, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500 gap-2">
        <p className="font-medium">No historical data available</p>
        <p className="text-xs">Select a test with multiple entries to see trends.</p>
      </div>
    );
  }

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any[];
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload as (typeof chartData)[0];
      return (
        <div className="bg-white p-3 rounded-xl shadow-xl border border-gray-100">
          <p className="font-semibold text-gray-800 text-sm mb-1">{dataPoint.fullDate}</p>
          <div className="flex items-center gap-2">
            <span
              className={`font-bold text-lg ${
                dataPoint.isAbnormal ? 'text-red-500' : 'text-blue-600'
              }`}
            >
              {dataPoint.value} {dataPoint.referenceRange?.unit}
            </span>
            {dataPoint.isAbnormal && (
              <span className="text-[10px] uppercase tracking-wider font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md">
                Abnormal
              </span>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="dateFormatted"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            dy={10}
          />
          <YAxis
            domain={yDomain}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />

          {refRange && (
            <ReferenceArea
              y1={refRange.min}
              y2={refRange.max}
              fill="#eff6ff"
              fillOpacity={0.6}
              stroke="none"
            />
          )}

          <Line
            type="monotone"
            dataKey="numericValue"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7, fill: '#db2777', strokeWidth: 0 }}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>

      {refRange && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            <div className="w-3 h-3 bg-blue-50 rounded-sm border border-blue-100"></div>
            <span>
              Normal Range ({refRange.min}-{refRange.max} {refRange.unit})
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
            <span>Result Value</span>
          </div>
        </div>
      )}
    </div>
  );
}
