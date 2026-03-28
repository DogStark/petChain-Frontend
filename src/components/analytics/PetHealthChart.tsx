
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PetHealthChartProps {
    data: {
        name: string;
        value: number;
        color: string;
    }[];
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const PetHealthChart: React.FC<PetHealthChartProps> = ({ data }) => {
    return (
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <h3 className="text-lg font-bold mb-4 text-blue-700">Pet Health Distribution</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomizedLabel}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend layout="vertical" verticalAlign="middle" align="right" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PetHealthChart;
