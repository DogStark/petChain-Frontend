
import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

interface UserEngagementChartProps {
    data: {
        date: string;
        activeUsers: number;
        newSignups: number;
    }[];
}

const UserEngagementChart: React.FC<UserEngagementChartProps> = ({ data }) => {
    return (
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <h3 className="text-lg font-bold mb-4 text-blue-700">User Engagement (Last 7 Days)</h3>
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
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="activeUsers"
                            name="Active Users"
                            stroke="#4f46e5"
                            activeDot={{ r: 8 }}
                            strokeWidth={2}
                        />
                        <Line
                            type="monotone"
                            dataKey="newSignups"
                            name="New Signups"
                            stroke="#10b981"
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default UserEngagementChart;
