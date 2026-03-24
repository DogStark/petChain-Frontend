import React from 'react';
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

interface FinancialReportChartProps {
    data: {
        month: string;
        revenue: number;
        expenses: number;
        profit: number;
    }[];
}

const FinancialReportChart: React.FC<FinancialReportChartProps> = ({ data }) => {
    return (
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <h3 className="text-lg font-bold mb-4 text-emerald-700">Financial Overview</h3>
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
                        <YAxis stroke="#6b7280" axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                        <Bar
                            dataKey="revenue"
                            name="Revenue"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                        />
                        <Bar
                            dataKey="expenses"
                            name="Expenses"
                            fill="#ef4444"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                        />
                        <Bar
                            dataKey="profit"
                            name="Net Profit"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default FinancialReportChart;
