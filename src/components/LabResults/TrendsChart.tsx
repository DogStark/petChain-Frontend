import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { LabResultItem } from "@/types/lab-results";

interface TrendsChartProps {
  data: LabResultItem[];
}

export default function TrendsChart({ data }: TrendsChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
        No historical data available.
      </div>
    );
  }

  // Format data for Recharts, keeping value numeric
  const chartData = data.map((item) => {
    const numericValue =
      typeof item.value === "string" ? parseFloat(item.value) || 0 : item.value;
    return {
      ...item,
      dateFormatted: new Date(item.date).toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
      }),
      fullDate: new Date(item.date).toLocaleDateString(),
      numericValue,
    };
  });

  const yMin = Math.min(...chartData.map((d) => d.numericValue)) * 0.8;
  const yMax = Math.max(...chartData.map((d) => d.numericValue)) * 1.2;

  // Assume reference range is the same across tests (using latest)
  const refRange = chartData[0]?.referenceRange;

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
        <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100">
          <p className="font-semibold text-gray-800">{dataPoint.fullDate}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`font-bold ${dataPoint.isAbnormal ? "text-red-500" : "text-blue-600"}`}
            >
              {dataPoint.value} {dataPoint.referenceRange?.unit}
            </span>
            {dataPoint.isAbnormal && (
              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md">
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
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f0f0f0"
          />
          <XAxis
            dataKey="dateFormatted"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            dy={10}
          />
          <YAxis
            domain={[yMin, yMax]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference Range Area */}
          {refRange && (
            <ReferenceArea
              y1={refRange.min}
              y2={refRange.max}
              fill="#e0f2fe"
              fillOpacity={0.5}
            />
          )}

          <Line
            type="monotone"
            dataKey="numericValue"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#db2777", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend / Range Indicator Info */}
      {refRange && (
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-100 rounded-sm"></div>
            <span>
              Normal Range ({refRange.min}-{refRange.max} {refRange.unit})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
