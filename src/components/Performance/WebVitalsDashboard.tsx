import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PERFORMANCE_BUDGETS, formatMetricValue, type PerformanceBudget } from '@/lib/webVitalsReporter';

interface MetricSummary {
  good: number;
  needsImprovement: number;
  poor: number;
  avg: number;
  p75: number;
  p95: number;
}

interface WebVitalsSummary {
  lcp: MetricSummary;
  fid: MetricSummary;
  cls: MetricSummary;
  ttfb: MetricSummary;
  inp: MetricSummary;
  totalReports: number;
}

interface RecentReport {
  metric: { name: string; value: number; rating: string };
  page: string;
  timestamp: string;
}

const METRIC_LABELS: Record<string, string> = {
  lcp: 'LCP',
  fid: 'FID',
  cls: 'CLS',
  ttfb: 'TTFB',
  inp: 'INP',
};

function RatingBadge({ rating }: { rating: string }) {
  const colors: Record<string, string> = {
    good: 'bg-green-100 text-green-800',
    'needs-improvement': 'bg-yellow-100 text-yellow-800',
    poor: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[rating] || 'bg-gray-100 text-gray-800'}`}>
      {rating}
    </span>
  );
}

function MetricGauge({ label, summary, budget }: { label: string; summary: MetricSummary; budget?: PerformanceBudget }) {
  const total = summary.good + summary.needsImprovement + summary.poor;
  const goodPct = total > 0 ? (summary.good / total) * 100 : 0;
  const niPct = total > 0 ? (summary.needsImprovement / total) * 100 : 0;
  const poorPct = total > 0 ? (summary.poor / total) * 100 : 0;

  const avgRating = summary.avg <= (budget?.good || 0) ? 'good' : summary.avg <= (budget?.needsImprovement || 0) ? 'needs-improvement' : 'poor';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
        <RatingBadge rating={avgRating} />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Average</span>
          <span className="font-medium text-gray-900">{formatMetricValue(label, summary.avg)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">P75</span>
          <span className="font-medium text-gray-900">{formatMetricValue(label, summary.p75)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">P95</span>
          <span className="font-medium text-gray-900">{formatMetricValue(label, summary.p95)}</span>
        </div>
      </div>

      {total > 0 && (
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
          <div className="bg-green-500 h-full transition-all" style={{ width: `${goodPct}%` }} title={`${summary.good} good`} />
          <div className="bg-yellow-500 h-full transition-all" style={{ width: `${niPct}%` }} title={`${summary.needsImprovement} needs improvement`} />
          <div className="bg-red-500 h-full transition-all" style={{ width: `${poorPct}%` }} title={`${summary.poor} poor`} />
        </div>
      )}

      {total > 0 && (
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>{summary.good} good</span>
          <span>{summary.needsImprovement} ni</span>
          <span>{summary.poor} poor</span>
        </div>
      )}

      {total === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">No data collected yet</p>
      )}
    </div>
  );
}

function TrendChart({ data, dataKey, label, unit }: { data: any[]; dataKey: string; label: string; unit: string }) {
  if (!data?.length) {
    return (
      <div className="h-48 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
        No trend data available
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} unit={unit} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey={dataKey} stroke="#3b82f6" strokeWidth={2} fill={`url(#gradient-${dataKey})`} name={label} unit={unit} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BudgetTable() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-500">Metric</th>
            <th className="text-left py-2 px-3 font-medium text-gray-500">Good</th>
            <th className="text-left py-2 px-3 font-medium text-gray-500">Needs Improvement</th>
            <th className="text-left py-2 px-3 font-medium text-gray-500">Poor</th>
          </tr>
        </thead>
        <tbody>
          {PERFORMANCE_BUDGETS.map((budget) => (
            <tr key={budget.metric} className="border-b border-gray-100">
              <td className="py-2 px-3 font-medium text-gray-900">{budget.metric}</td>
              <td className="py-2 px-3 text-green-600">{formatMetricValue(budget.metric, budget.good)}</td>
              <td className="py-2 px-3 text-yellow-600">{formatMetricValue(budget.metric, budget.needsImprovement)}</td>
              <td className="py-2 px-3 text-red-600">&gt; {formatMetricValue(budget.metric, budget.needsImprovement)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WebVitalsDashboard() {
  const [summary, setSummary] = useState<WebVitalsSummary | null>(null);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<any[]>([]);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/web-vitals/report');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!active) return;

        setSummary(data.summary);
        setRecentReports((data.reports || []).reverse());

        const trends = (data.reports || [])
          .filter((r: RecentReport) => r.metric.name === 'LCP')
          .slice(-20)
          .map((r: RecentReport) => ({
            time: new Date(r.timestamp).toLocaleTimeString(),
            value: r.metric.value,
          }));
        setTrendData(trends);
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load data');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, 15000);
    return () => { active = false; clearInterval(id); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        Failed to load web vitals: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {summary && (
          <>
            <MetricGauge label="LCP" summary={summary.lcp} budget={PERFORMANCE_BUDGETS.find((b) => b.metric === 'LCP')} />
            <MetricGauge label="FID" summary={summary.fid} budget={PERFORMANCE_BUDGETS.find((b) => b.metric === 'FID')} />
            <MetricGauge label="CLS" summary={summary.cls} budget={PERFORMANCE_BUDGETS.find((b) => b.metric === 'CLS')} />
            <MetricGauge label="TTFB" summary={summary.ttfb} budget={PERFORMANCE_BUDGETS.find((b) => b.metric === 'TTFB')} />
            <MetricGauge label="INP" summary={summary.inp} budget={PERFORMANCE_BUDGETS.find((b) => b.metric === 'INP')} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">LCP Trend (Last 20)</h3>
          <TrendChart data={trendData} dataKey="value" label="LCP" unit=" ms" />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Budgets</h3>
          <BudgetTable />
        </div>
      </div>

      {summary && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Reports</h3>
            <span className="text-sm text-gray-500">Total: {summary.totalReports}</span>
          </div>

          {recentReports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Metric</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Value</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Page</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-500">{new Date(r.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 px-3 font-medium text-gray-900">{r.metric.name}</td>
                      <td className="py-2 px-3 text-gray-900">{formatMetricValue(r.metric.name, r.metric.value)}</td>
                      <td className="py-2 px-3 text-gray-500 max-w-[200px] truncate">{r.page}</td>
                      <td className="py-2 px-3"><RatingBadge rating={r.metric.rating} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No reports collected yet</p>
          )}
        </div>
      )}
    </div>
  );
}
