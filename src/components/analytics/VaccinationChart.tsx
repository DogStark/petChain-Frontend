
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface VaccinationChartProps {
    data: {
        month: string;
        compliant: number;
        nonCompliant: number;
    }[];
}

const VaccinationChart: React.FC<VaccinationChartProps> = ({ data }) => {
    return (
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            <h3 className="text-lg font-bold mb-4 text-blue-700">Vaccination Compliance Rates</h3>
            <div className="h-64">
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Legend />
                        <Bar dataKey="compliant" name="Compliant %" stackId="a" fill="#10b981" />
                        <Bar dataKey="nonCompliant" name="Non-Compliant %" stackId="a" fill="#ef4444" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default VaccinationChart;
