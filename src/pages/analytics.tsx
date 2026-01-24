
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { Download, RefreshCw } from 'lucide-react';
import { generateAnalyticsData } from '../lib/analyticsUserData';

const UserEngagementChart = dynamic(() => import('../components/analytics/UserEngagementChart'), { ssr: false });
const PetHealthChart = dynamic(() => import('../components/analytics/PetHealthChart'), { ssr: false });
const VaccinationChart = dynamic(() => import('../components/analytics/VaccinationChart'), { ssr: false });
const GeoDistributionChart = dynamic(() => import('../components/analytics/GeoDistributionChart'), { ssr: false });
const ApiUsageChart = dynamic(() => import('../components/analytics/ApiUsageChart'), { ssr: false });

interface AnalyticsData {
    engagementData: { date: string; activeUsers: number; newSignups: number }[];
    healthData: { name: string; value: number; color: string }[];
    vaccinationData: { month: string; compliant: number; nonCompliant: number }[];
    geoData: { region: string; users: number }[];
    apiUsageData: { time: string; requests: number; errors: number }[];
    timestamp: string;
}

const AnalyticsPage = () => {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchData = () => {
        const newData = generateAnalyticsData();
        setData(newData);
        setLastUpdated(new Date());
        setLoading(false);
    };

    useEffect(() => {
        fetchData();

        const interval = setInterval(() => {
            fetchData();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const handleExport = () => {
        if (!data) return;

        const toCSV = (arr: any[], headers: string[]) => {
            const headerRow = headers.join(',');

            const rows = arr.map((obj: any) => headers.map(header => JSON.stringify(obj[header])).join(','));
            return [headerRow, ...rows].join('\n');
        };

        const engagementCSV = toCSV(data.engagementData, ['date', 'activeUsers', 'newSignups']);
        const healthCSV = toCSV(data.healthData, ['name', 'value']);
        const vaccinationCSV = toCSV(data.vaccinationData, ['month', 'compliant', 'nonCompliant']);
        const geoCSV = toCSV(data.geoData, ['region', 'users']);
        const apiCSV = toCSV(data.apiUsageData, ['time', 'requests', 'errors']);

        const finalCSV = [
            `Report Generated,${new Date().toISOString()}`,
            '',
            'User Engagement',
            engagementCSV,
            '',
            'Pet Health ',
            healthCSV,
            '',
            'Vaccination Compliance ',
            vaccinationCSV,
            '',
            'Geographic Distribution ',
            geoCSV,
            '',
            'API Usage ',
            apiCSV
        ].join('\n');

        const blob = new Blob([finalCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics_report_${new Date().toISOString()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-xl font-medium text-gray-500">Loading Analytics...</div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-green-50 p-4 md:p-8 flex flex-col transition-all duration-300">
            <Head>
                <title>Analytics Dashboard | PetChain</title>
            </Head>

            <div className="mx-auto max-w-7xl w-full">
                {/* Header */}
                <div className="mb-6 md:mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg transition-all duration-300">
                    <div className="text-center md:text-left w-full md:w-auto">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 drop-shadow-sm">Analytics Dashboard</h1>
                        <p className="mt-2 text-sm md:text-lg text-gray-700">
                            Platform usage and health insights.
                            <span className="block md:inline text-xs md:text-sm text-gray-500 mt-1 md:mt-0 md:ml-2">
                                Last updated: {lastUpdated.toLocaleTimeString()}
                            </span>
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <button
                            onClick={fetchData}
                            className="flex items-center cursor-pointer  justify-center gap-2 rounded-full bg-white px-6 py-3 md:py-2.5 text-sm font-semibold text-blue-700 shadow-md border border-blue-100 hover:bg-blue-50 hover:scale-105 active:scale-95 transition-all duration-300 w-full sm:w-auto"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center cursor-pointer justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 md:py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 w-full sm:w-auto"
                        >
                            <Download className="h-4 w-4" />
                            Export Report
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
                    <div className="lg:col-span-8">
                        <UserEngagementChart data={data.engagementData} />
                    </div>

                    <div className="lg:col-span-4">
                        <PetHealthChart data={data.healthData} />
                    </div>

                    <div className="lg:col-span-6">
                        <VaccinationChart data={data.vaccinationData} />
                    </div>

                    <div className="lg:col-span-6">
                        <GeoDistributionChart data={data.geoData} />
                    </div>

                    <div className="lg:col-span-12">
                        <ApiUsageChart data={data.apiUsageData} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
