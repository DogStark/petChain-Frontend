import React, { useState, useRef } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import { Download, Calendar, Activity, DollarSign, ActivitySquare, LayoutDashboard, FileText } from 'lucide-react';

// Import Charts
import UserEngagementChart from '@/components/analytics/UserEngagementChart';
import ApiUsageChart from '@/components/analytics/ApiUsageChart';
import PetHealthChart from '@/components/analytics/PetHealthChart';
import VaccinationChart from '@/components/analytics/VaccinationChart';
import GeoDistributionChart from '@/components/analytics/GeoDistributionChart';
import FinancialReportChart from '@/components/analytics/FinancialReportChart';

// Mock Data for Reports
const MOCK_ENGAGEMENT_DATA = [
    { date: 'Mon', activeUsers: 1200, newSignups: 45 },
    { date: 'Tue', activeUsers: 1350, newSignups: 52 },
    { date: 'Wed', activeUsers: 1100, newSignups: 38 },
    { date: 'Thu', activeUsers: 1420, newSignups: 65 },
    { date: 'Fri', activeUsers: 1580, newSignups: 72 },
    { date: 'Sat', activeUsers: 1800, newSignups: 95 },
    { date: 'Sun', activeUsers: 1950, newSignups: 110 },
];

const MOCK_FINANCIAL_DATA = [
    { month: 'Jan', revenue: 45000, expenses: 28000, profit: 17000 },
    { month: 'Feb', revenue: 52000, expenses: 31000, profit: 21000 },
    { month: 'Mar', revenue: 48000, expenses: 29000, profit: 19000 },
    { month: 'Apr', revenue: 61000, expenses: 34000, profit: 27000 },
    { month: 'May', revenue: 59000, expenses: 33000, profit: 26000 },
    { month: 'Jun', revenue: 75000, expenses: 40000, profit: 35000 },
];

const MOCK_HEALTH_DATA = [
    { month: 'Jan', healthy: 85, sick: 10, critical: 5 },
    { month: 'Feb', healthy: 82, sick: 12, critical: 6 },
    { month: 'Mar', healthy: 88, sick: 9, critical: 3 },
    { month: 'Apr', healthy: 86, sick: 11, critical: 3 },
    { month: 'May', healthy: 90, sick: 8, critical: 2 },
    { month: 'Jun', healthy: 92, sick: 7, critical: 1 },
];

const MOCK_VACCINATION_DATA = [
    { name: 'Rabies', completed: 850, pending: 150 },
    { name: 'Parvovirus', completed: 720, pending: 280 },
    { name: 'Distemper', completed: 680, pending: 320 },
    { name: 'Bordetella', completed: 450, pending: 550 },
];

const MOCK_API_DATA = [
    { time: '00:00', requests: 120, errors: 2 },
    { time: '04:00', requests: 80, errors: 1 },
    { time: '08:00', requests: 450, errors: 5 },
    { time: '12:00', requests: 850, errors: 12 },
    { time: '16:00', requests: 920, errors: 8 },
    { time: '20:00', requests: 600, errors: 4 },
];

const MOCK_GEO_DATA = [
    { region: 'North America', users: 4500 },
    { region: 'Europe', users: 3200 },
    { region: 'Asia', users: 2800 },
    { region: 'South America', users: 1500 },
    { region: 'Australia', users: 900 },
];

type ReportTab = 'activity' | 'financial' | 'health' | 'usage' | 'scheduled' | 'templates';

export default function AdminReports() {
    const [activeTab, setActiveTab] = useState<ReportTab>('activity');
    const reportRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        window.print();
    };

    const tabs: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
        { id: 'activity', label: 'User Activity', icon: <Activity className="w-5 h-5" /> },
        { id: 'financial', label: 'Financial', icon: <DollarSign className="w-5 h-5" /> },
        { id: 'health', label: 'Health Trends', icon: <ActivitySquare className="w-5 h-5" /> },
        { id: 'usage', label: 'System Usage', icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'scheduled', label: 'Scheduled', icon: <Calendar className="w-5 h-5" /> },
        { id: 'templates', label: 'Templates', icon: <FileText className="w-5 h-5" /> },
    ];

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50 print:bg-white text-slate-800 font-sans">
                <Head>
                    <title>Admin Reports | PetChain</title>
                </Head>

                {/* Hide Header when printing */}
                <div className="print:hidden">
                    <Header />
                </div>

                <main className="container mx-auto px-4 py-8">
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 print:hidden">
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Reporting</h1>
                            <p className="text-slate-500 mt-1">Generate and export comprehensive platform insights</p>
                        </div>
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                            <Download className="w-5 h-5" />
                            Export Data
                        </button>
                    </div>

                    {/* Report Tabs - Hidden on Print */}
                    <div className="mb-8 overflow-x-auto pb-2 print:hidden hide-scrollbar">
                        <div className="flex space-x-2 min-w-max">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${activeTab === tab.id
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-sm'
                                        }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Printable Report Content area */}
                    <div
                        ref={reportRef}
                        className="print:p-0"
                    >
                        {/* Print Header (Only visible when printing) */}
                        <div className="hidden print:block mb-8 border-b pb-4">
                            <h1 className="text-3xl font-bold text-slate-900">PetChain Admin Report</h1>
                            <p className="text-slate-500 mt-1">
                                Category: {tabs.find(t => t.id === activeTab)?.label} | Generated on: {new Date().toLocaleDateString()}
                            </p>
                        </div>

                        {/* Activity Reprts */}
                        {activeTab === 'activity' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="col-span-1 lg:col-span-2">
                                    <UserEngagementChart data={MOCK_ENGAGEMENT_DATA} />
                                </div>

                                <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent">
                                    <h3 className="text-lg font-bold mb-4 text-blue-700">Recent User Logs</h3>
                                    <div className="space-y-4">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                        U{i}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800">User logged in</p>
                                                        <p className="text-xs text-slate-500">Just now • IP: 192.168.1.{i}</p>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">Success</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-3xl shadow-lg text-white flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">Total Platform Users</h3>
                                        <p className="text-indigo-100">Across all roles and regions</p>
                                    </div>
                                    <div className="mt-8">
                                        <h2 className="text-5xl font-extrabold">24,592</h2>
                                        <p className="text-indigo-100 mt-2 flex items-center gap-2">
                                            <span className="bg-white/20 px-2 py-1 rounded text-sm">+12.5%</span> from last month
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Financial Reports */}
                        {activeTab === 'financial' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <FinancialReportChart data={MOCK_FINANCIAL_DATA} />

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {[
                                        { label: 'Total Revenue YTD', value: '$340,000', trend: '+18.2%' },
                                        { label: 'Operating Expenses YTD', value: '$195,000', trend: '+5.4%' },
                                        { label: 'Net Profit YTD', value: '$145,000', trend: '+24.6%' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-white p-6 rounded-3xl shadow-md border border-slate-100">
                                            <h4 className="text-slate-500 font-medium mb-1">{stat.label}</h4>
                                            <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
                                            <p className="text-sm text-green-600 font-medium mt-2">{stat.trend} vs last year</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Health Trend Reports */}
                        {activeTab === 'health' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <PetHealthChart data={MOCK_HEALTH_DATA} />
                                <VaccinationChart data={MOCK_VACCINATION_DATA} />
                            </div>
                        )}

                        {/* System Usage Reports */}
                        {activeTab === 'usage' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="col-span-1 lg:col-span-2">
                                    <ApiUsageChart data={MOCK_API_DATA} />
                                </div>
                                <GeoDistributionChart data={MOCK_GEO_DATA} />

                                <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent">
                                    <h3 className="text-lg font-bold mb-4 text-slate-800">System Capacity</h3>
                                    <div className="space-y-6">
                                        {[
                                            { label: 'Database Storage', value: 68, color: 'bg-blue-500' },
                                            { label: 'IPFS Storage', value: 42, color: 'bg-emerald-500' },
                                            { label: 'Server CPU Usage', value: 24, color: 'bg-indigo-500' },
                                            { label: 'Memory Allocation', value: 85, color: 'bg-amber-500' },
                                        ].map((resource, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between text-sm font-medium mb-2">
                                                    <span className="text-slate-600">{resource.label}</span>
                                                    <span className="text-slate-800">{resource.value}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2.5">
                                                    <div className={`${resource.color} h-2.5 rounded-full`} style={{ width: `${resource.value}%` }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Scheduled Reports */}
                        {activeTab === 'scheduled' && (
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 print:hidden">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-800">Automated Report Deliveries</h3>
                                    <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
                                        + New Schedule
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="py-4 font-semibold text-slate-500">Report Name</th>
                                                <th className="py-4 font-semibold text-slate-500">Frequency</th>
                                                <th className="py-4 font-semibold text-slate-500">Recipients</th>
                                                <th className="py-4 font-semibold text-slate-500">Next Run</th>
                                                <th className="py-4 font-semibold text-slate-500 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { name: 'Weekly Platform Summary', freq: 'Weekly (Monday)', rec: 'admin@petchain.com', next: 'Oct 24, 08:00 AM' },
                                                { name: 'Monthly Financial Audit', freq: 'Monthly (1st)', rec: 'finance@petchain.com', next: 'Nov 01, 12:00 AM' },
                                                { name: 'Daily System Health', freq: 'Daily', rec: 'devops@petchain.com', next: 'Tomorrow, 06:00 AM' },
                                            ].map((report, i) => (
                                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                                                    <td className="py-4 font-medium text-slate-800">{report.name}</td>
                                                    <td className="py-4 text-slate-600 text-sm">
                                                        <span className="px-2.5 py-1 bg-slate-100 rounded-full text-slate-700">{report.freq}</span>
                                                    </td>
                                                    <td className="py-4 text-slate-600">{report.rec}</td>
                                                    <td className="py-4 text-slate-600">{report.next}</td>
                                                    <td className="py-4 text-right">
                                                        <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Templates */}
                        {activeTab === 'templates' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 print:hidden">
                                {[
                                    { title: 'Executive YTD Summary', desc: 'High-level aggregation of revenue, user growth, and critical system health alerts.', color: 'from-blue-500 to-indigo-600' },
                                    { title: 'Clinical Operations', desc: 'Granular view of appointments, procedures, and veterinary facility engagement.', color: 'from-emerald-400 to-teal-500' },
                                    { title: 'Network Performance', desc: 'Detailed metrics on API latency, error rates, and Blockchain transaction gas costs.', color: 'from-slate-700 to-slate-900' },
                                    { title: 'Compliance Audit', desc: 'Logs of data access, profile modifications, and privacy consent status.', color: 'from-violet-500 to-purple-600' },
                                ].map((template, i) => (
                                    <div key={i} className="group cursor-pointer bg-white rounded-3xl p-6 shadow-md border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
                                        <div className={`w-12 h-12 rounded-2xl mb-4 bg-gradient-to-br ${template.color} shadow-inner flex items-center justify-center`}>
                                            <FileText className="w-6 h-6 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">{template.title}</h3>
                                        <p className="text-slate-500 flex-grow text-sm leading-relaxed">{template.desc}</p>
                                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-sm font-semibold text-blue-600">Use Template</span>
                                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                →
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Embedded styles for print optimization */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: landscape; margin: 1cm; }
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .recharts-responsive-container { width: 100% !important; min-height: 400px !important; }
                    .shadow-lg, .shadow-md, .shadow-xl { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
                }
            `}} />
        </ProtectedRoute>
    );
}
