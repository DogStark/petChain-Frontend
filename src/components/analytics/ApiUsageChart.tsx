
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ApiUsageChartProps {
    data: {
        time: string;
        requests: number;
        errors: number;
    }[];
}

const ApiUsageChart: React.FC<ApiUsageChartProps> = ({ data }) => {
    return (
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <h3 className="text-lg font-bold mb-4 text-blue-700">API Usage Statistics</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="time" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Area type="monotone" dataKey="requests" stackId="1" stroke="#8884d8" fill="#8884d8" />
                        <Area type="monotone" dataKey="errors" stackId="1" stroke="#ef4444" fill="#ef4444" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ApiUsageChart;
