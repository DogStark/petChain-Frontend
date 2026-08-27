import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { HistoricalRatePoint } from '@/lib/api/rateAPI';

interface RateHistoryChartProps {
  data: HistoricalRatePoint[];
  symbol: string;
  interval: string;
}

interface ChartPoint {
  label: string;
  price: number;
  timestamp: string;
}

function formatLabel(timestamp: string, interval: string): string {
  const date = new Date(timestamp);
  if (interval === '1') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 text-xs">
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="font-bold text-blue-700">{value !== undefined ? formatPrice(value) : '—'}</p>
    </div>
  );
}

export default function RateHistoryChart({ data, symbol, interval }: RateHistoryChartProps) {
  const chartData: ChartPoint[] = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Downsample to at most 60 points for readability
    const step = Math.max(1, Math.floor(data.length / 60));
    return data
      .filter((_, i) => i % step === 0 || i === data.length - 1)
      .map((point) => ({
        label: formatLabel(point.timestamp, interval),
        price: point.priceUSD,
        timestamp: point.timestamp,
      }));
  }, [data, interval]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-2">
        <svg
          className="w-10 h-10 text-gray-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
        <p className="text-sm">No historical data available</p>
      </div>
    );
  }

  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.05 || maxPrice * 0.01;

  // Determine trend colour
  const isPositive = chartData[chartData.length - 1].price >= chartData[0].price;
  const strokeColor = isPositive ? '#10b981' : '#ef4444';
  const gradientId = `rateGradient-${symbol}`;

  return (
    <div className="h-64" role="img" aria-label={`${symbol} price history chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#9ca3af"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#9ca3af"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatPrice}
            domain={[minPrice - padding, maxPrice + padding]}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="price"
            name={`${symbol} Price (USD)`}
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
