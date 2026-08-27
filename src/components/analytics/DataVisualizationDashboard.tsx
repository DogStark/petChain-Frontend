/**
 * Data Visualization Dashboard
 * Interactive charts and graphs for pet health trends, vaccination schedules,
 * weight tracking, and geographic vet clinic locations.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, RadialBarChart, RadialBar,
} from 'recharts';
import {
  Download, Calendar, Weight, Activity, Syringe,
  MapPin, TrendingUp, Filter, RefreshCw,
} from 'lucide-react';

// ── Types ──

export interface WeightDataPoint {
  date: string;
  weight: number;
  petName?: string;
}

export interface VaccinationDataPoint {
  date: string;
  vaccine: string;
  status: 'completed' | 'upcoming' | 'overdue';
  petName?: string;
}

export interface HealthMetric {
  metric: string;
  value: number;
  unit: string;
  normalRange: { min: number; max: number };
  timestamp: string;
}

export interface VetLocation {
  name: string;
  city: string;
  region: string;
  pets: number;
  rating: number;
}

export interface DashboardData {
  weightHistory: WeightDataPoint[];
  vaccinations: VaccinationDataPoint[];
  healthMetrics: HealthMetric[];
  vetLocations: VetLocation[];
  summary: {
    totalPets: number;
    upcomingVaccinations: number;
    averageWeight: number;
    abnormalResults: number;
  };
}

// ── Time Range Filter ──

type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: '1 Month', value: '1M' },
  { label: '3 Months', value: '3M' },
  { label: '6 Months', value: '6M' },
  { label: '1 Year', value: '1Y' },
  { label: 'All Time', value: 'ALL' },
];

function filterByTimeRange<T extends { date?: string; timestamp?: string }>(
  data: T[],
  range: TimeRange
): T[] {
  if (range === 'ALL') return data;
  const now = Date.now();
  const msMap: Record<TimeRange, number> = {
    '1M': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '6M': 180 * 24 * 60 * 60 * 1000,
    '1Y': 365 * 24 * 60 * 60 * 1000,
    ALL: Infinity,
  };
  const cutoff = now - (msMap[range] || msMap['1Y']);
  return data.filter((item) => {
    const ts = item.date || item.timestamp;
    return ts ? new Date(ts).getTime() >= cutoff : true;
  });
}

// ── Export Utilities ──

function exportToCSV(filename: string, headers: string[], rows: unknown[][]): void {
  const headerRow = headers.join(',');
  const dataRows = rows.map((row) => row.map((cell) => JSON.stringify(cell)).join(','));
  const csv = [headerRow, ...dataRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Custom Tooltip ──

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

// ── Sub-Components ──

interface WeightChartProps {
  data: WeightDataPoint[];
  timeRange: TimeRange;
  onExport: () => void;
}

function WeightChart({ data, timeRange, onExport }: WeightChartProps) {
  const filtered = useMemo(() => filterByTimeRange(data, timeRange), [data, timeRange]);
  const chartData = useMemo(
    () =>
      filtered.map((d) => ({
        ...d,
        dateFormatted: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      })),
    [filtered]
  );

  if (!chartData.length) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
        No weight data available for this period.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-blue-700">Weight & Growth Tracking</h3>
        <button onClick={onExport} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="dateFormatted" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" kg" />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} fill="url(#weightGradient)" name="Weight" unit=" kg" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface VaccinationScheduleChartProps {
  data: VaccinationDataPoint[];
  timeRange: TimeRange;
  onExport: () => void;
}

function VaccinationScheduleChart({ data, timeRange, onExport }: VaccinationScheduleChartProps) {
  const filtered = useMemo(() => filterByTimeRange(data as any, timeRange) as VaccinationDataPoint[], [data, timeRange]);

  const chartData = useMemo(() => {
    const grouped: Record<string, { completed: number; upcoming: number; overdue: number }> = {};
    filtered.forEach((d) => {
      if (!grouped[d.vaccine]) {
        grouped[d.vaccine] = { completed: 0, upcoming: 0, overdue: 0 };
      }
      grouped[d.vaccine][d.status]++;
    });
    return Object.entries(grouped).map(([vaccine, counts]) => ({ vaccine, ...counts }));
  }, [filtered]);

  if (!chartData.length) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
        No vaccination data available.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-blue-700">Vaccination Schedule</h3>
        <button onClick={onExport} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis dataKey="vaccine" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={100} />
            <Tooltip />
            <Legend />
            <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[0, 4, 4, 0]} stackId="a" />
            <Bar dataKey="upcoming" name="Upcoming" fill="#3b82f6" radius={[0, 4, 4, 0]} stackId="a" />
            <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[0, 4, 4, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface HealthMetricsChartProps {
  data: HealthMetric[];
  timeRange: TimeRange;
  onExport: () => void;
}

function HealthMetricsChart({ data, timeRange, onExport }: HealthMetricsChartProps) {
  const filtered = useMemo(() => filterByTimeRange(data as any, timeRange) as HealthMetric[], [data, timeRange]);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const unique = [...new Set(filtered.map((d) => d.metric))];
    return unique;
  }, [filtered]);

  const activeMetric = selectedMetric || metrics[0] || '';

  const metricData = useMemo(
    () =>
      filtered
        .filter((d) => d.metric === activeMetric)
        .map((d) => ({
          ...d,
          dateFormatted: new Date(d.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          aboveRange: d.value > d.normalRange.max,
          belowRange: d.value < d.normalRange.min,
        })),
    [filtered, activeMetric]
  );

  if (!metrics.length) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
        No health metrics available.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-blue-700">Health Metrics</h3>
        <button onClick={onExport} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {metrics.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMetric(m)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              activeMetric === m
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={metricData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="dateFormatted" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              fill="#dbeafe"
              strokeWidth={2}
              name={activeMetric}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.aboveRange) return <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
                if (payload.belowRange) return <circle cx={cx} cy={cy} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={2} />;
                return <circle cx={cx} cy={cy} r={3} fill="#3b82f6" stroke="#fff" strokeWidth={1.5} />;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Above range</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Below range</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Normal</span>
      </div>
    </div>
  );
}

interface VetLocationChartProps {
  data: VetLocation[];
  onExport: () => void;
}

function VetLocationChart({ data, onExport }: VetLocationChartProps) {
  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    data.forEach((loc) => {
      grouped[loc.region] = (grouped[loc.region] || 0) + loc.pets;
    });
    return Object.entries(grouped)
      .map(([region, pets]) => ({ region, pets }))
      .sort((a, b) => b.pets - a.pets);
  }, [data]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (!chartData.length) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
        No geographic data available.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-blue-700">Vet Clinic Distribution</h3>
        <button onClick={onExport} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="pets"
              nameKey="region"
              label={({ region, percent }) => `${region} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Summary Cards ──

interface SummaryCardsProps {
  summary: DashboardData['summary'];
}

function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    { label: 'Total Pets', value: summary.totalPets, icon: Activity, color: 'bg-blue-500' },
    { label: 'Upcoming Vaccinations', value: summary.upcomingVaccinations, icon: Syringe, color: 'bg-green-500' },
    { label: 'Avg Weight', value: `${summary.averageWeight.toFixed(1)} kg`, icon: Weight, color: 'bg-purple-500' },
    { label: 'Abnormal Results', value: summary.abnormalResults, icon: TrendingUp, color: 'bg-red-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`${card.color} p-2 rounded-xl text-white`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-xl font-bold text-gray-800">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard Component ──

interface DataVisualizationDashboardProps {
  data: DashboardData;
  className?: string;
}

export default function DataVisualizationDashboard({ data, className = '' }: DataVisualizationDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('6M');

  const handleExportWeight = useCallback(() => {
    exportToCSV('weight_tracking', ['Date', 'Weight (kg)'], data.weightHistory.map((d) => [d.date, d.weight]));
  }, [data.weightHistory]);

  const handleExportVaccination = useCallback(() => {
    exportToCSV('vaccination_schedule', ['Date', 'Vaccine', 'Status'], data.vaccinations.map((d) => [d.date, d.vaccine, d.status]));
  }, [data.vaccinations]);

  const handleExportHealthMetrics = useCallback(() => {
    exportToCSV('health_metrics', ['Metric', 'Value', 'Unit', 'Timestamp'], data.healthMetrics.map((d) => [d.metric, d.value, d.unit, d.timestamp]));
  }, [data.healthMetrics]);

  const handleExportVetLocations = useCallback(() => {
    exportToCSV('vet_clinics', ['Name', 'City', 'Region', 'Pets', 'Rating'], data.vetLocations.map((d) => [d.name, d.city, d.region, d.pets, d.rating]));
  }, [data.vetLocations]);

  const handleExportAll = useCallback(() => {
    handleExportWeight();
    setTimeout(handleExportVaccination, 500);
    setTimeout(handleExportHealthMetrics, 1000);
    setTimeout(handleExportVetLocations, 1500);
  }, [handleExportWeight, handleExportVaccination, handleExportHealthMetrics, handleExportVetLocations]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-blue-800">Data Visualization Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">
            Interactive charts for pet health trends and insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Filter */}
          <div className="flex items-center gap-1 bg-white rounded-full border border-gray-200 p-1 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-gray-400 ml-2" />
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setTimeRange(r.value)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  timeRange === r.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-full hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Export All
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={data.summary} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-blue-50">
          <WeightChart data={data.weightHistory} timeRange={timeRange} onExport={handleExportWeight} />
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-green-50">
          <VaccinationScheduleChart data={data.vaccinations} timeRange={timeRange} onExport={handleExportVaccination} />
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-purple-50 lg:col-span-2">
          <HealthMetricsChart data={data.healthMetrics} timeRange={timeRange} onExport={handleExportHealthMetrics} />
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-pink-50">
          <VetLocationChart data={data.vetLocations} onExport={handleExportVetLocations} />
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-amber-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-blue-700">Quick Actions</h3>
          </div>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left">
              <Calendar className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">Schedule Vaccination</p>
                <p className="text-xs text-gray-500">Book an appointment</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left">
              <Activity className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">Record Health Metrics</p>
                <p className="text-xs text-gray-500">Add new measurements</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left">
              <MapPin className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">Find Nearby Vets</p>
                <p className="text-xs text-gray-500">Explore clinic locations</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-gray-800">Generate Report</p>
                <p className="text-xs text-gray-500">Download comprehensive report</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
