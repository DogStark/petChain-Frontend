import React, { useMemo } from 'react';
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
import { Download } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';

/** Revenue categories shown as stacked bars. */
export const REVENUE_CATEGORIES = [
    { key: 'subscriptions', label: 'Subscriptions', color: '#10b981' },
    { key: 'transactions', label: 'Transactions', color: '#3b82f6' },
    { key: 'services', label: 'Services', color: '#8b5cf6' },
    { key: 'other', label: 'Other', color: '#f59e0b' },
] as const;

export type RevenueCategoryKey = (typeof REVENUE_CATEGORIES)[number]['key'];

export interface RevenueBreakdownPoint {
    /** Period label, e.g. "Jan" or "2026-01". */
    month: string;
    subscriptions: number;
    transactions: number;
    services: number;
    other: number;
}

export interface FinancialReportChartProps {
    data: RevenueBreakdownPoint[];
    /** Optional title override. */
    title?: string;
}

function toCsv(data: RevenueBreakdownPoint[]): string {
    const headers = ['Period', ...REVENUE_CATEGORIES.map((category) => category.label), 'Total'];
    const rows = data.map((point) => [
        point.month,
        ...REVENUE_CATEGORIES.map((category) => point[category.key] ?? 0),
        REVENUE_CATEGORIES.reduce((sum, category) => sum + (point[category.key] ?? 0), 0),
    ]);
    return [headers, ...rows]
        .map((row) => row.map((cell) => JSON.stringify(cell)).join(','))
        .join('\n');
}

function exportToCsv(data: RevenueBreakdownPoint[]): void {
    if (typeof window === 'undefined' || !data.length) return;
    const blob = new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue-breakdown_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

const FinancialReportChart: React.FC<FinancialReportChartProps> = ({ data, title = 'Revenue Breakdown' }) => {
    const totals = useMemo(
        () =>
            REVENUE_CATEGORIES.map((category) => ({
                ...category,
                total: data.reduce((sum, point) => sum + (point[category.key] ?? 0), 0),
            })),
        [data],
    );

    return (
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-emerald-700">{title}</h3>
                <button
                    type="button"
                    onClick={() => exportToCsv(data)}
                    disabled={!data.length}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Export CSV
                </button>
            </div>
            <ul className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
                {totals.map((category) => (
                    <li key={category.key}>
                        <span className="font-semibold" style={{ color: category.color }}>
                            {category.label}:
                        </span>{' '}
                        {formatCurrency(category.total)}
                    </li>
                ))}
            </ul>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="month" stroke="#6b7280" axisLine={false} tickLine={false} />
                        <YAxis stroke="#6b7280" axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
                            formatter={(value: number | string) => [formatCurrency(value), undefined]}
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                        {REVENUE_CATEGORIES.map((category, index) => (
                            <Bar
                                key={category.key}
                                dataKey={category.key}
                                name={category.label}
                                stackId="revenue"
                                fill={category.color}
                                radius={index === REVENUE_CATEGORIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                maxBarSize={40}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default FinancialReportChart;
