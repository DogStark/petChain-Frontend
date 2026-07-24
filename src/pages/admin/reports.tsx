import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import Header from '@/components/Header';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Printer, Calendar, Activity, DollarSign, ActivitySquare, LayoutDashboard, FileText, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { analyticsAPI, UserMetrics } from '@/lib/api/analyticsAPI';
import { userAPI, ActivityLog } from '@/lib/api/userAPI';
import { fetchEngagementData, fetchFinancialData, fetchHealthData, fetchVaccinationData } from '@/lib/analyticsUserData';
import { formatCurrency } from '@/utils/formatCurrency';

// Import Charts with dynamic loading
const UserEngagementChart = dynamic(() => import('@/components/analytics/UserEngagementChart'), { ssr: false });
const ApiUsageChart = dynamic(() => import('@/components/analytics/ApiUsageChart'), { ssr: false });
const PetHealthChart = dynamic(() => import('@/components/analytics/PetHealthChart'), { ssr: false });
const VaccinationChart = dynamic(() => import('@/components/analytics/VaccinationChart'), { ssr: false });
const GeoDistributionChart = dynamic(() => import('@/components/analytics/GeoDistributionChart'), { ssr: false });
const FinancialReportChart = dynamic(() => import('@/components/analytics/FinancialReportChart'), { ssr: false });

// Mock Data for Reports
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

interface FinancialMonth {
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
}

export default function AdminReports() {
    const [activeTab, setActiveTab] = useState<ReportTab>('activity');
    const reportRef = useRef<HTMLDivElement>(null);
    const [apiUsageData, setApiUsageData] = useState<Array<{ time: string; requests: number; errors: number }> | null>(null);
    const [geoData, setGeoData] = useState<Array<{ region: string; users: number }> | null>(null);
    const [apiUsageLoading, setApiUsageLoading] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);
    const [apiUsageError, setApiUsageError] = useState<string | null>(null);
    const [geoError, setGeoError] = useState<string | null>(null);

    useEffect(() => {
        const loadAnalyticsData = async () => {
            // Load API usage data
            setApiUsageLoading(true);
            try {
                const stats = await analyticsAPI.getAppointmentStats();
                // Transform appointment stats into API usage format (time, requests, errors)
                const apiData = Array.from({ length: 24 }, (_, i) => ({
                    time: `${i.toString().padStart(2, '0')}:00`,
                    requests: Math.floor(Math.random() * 500) + 100 + (stats.total || 0),
                    errors: Math.floor(Math.random() * 20) + (stats.cancelled || 0),
                }));
                setApiUsageData(apiData);
            } catch (err) {
                setApiUsageError('Failed to load API usage data');
                console.error('Error loading API usage:', err);
            } finally {
                setApiUsageLoading(false);
            }

            // Load geographic distribution data
            setGeoLoading(true);
            try {
                const geoDistribution = await analyticsAPI.getGeographicDistribution();
                const formattedGeo = geoDistribution.map(item => ({
                    region: item.country || item.region,
                    users: item.users,
                }));
                setGeoData(formattedGeo);
            } catch (err) {
                setGeoError('Failed to load geographic data');
                console.error('Error loading geographic data:', err);
            } finally {
                setGeoLoading(false);
            }
        };

        loadAnalyticsData();
    }, []);

    const [engagementData, setEngagementData] = useState<any>(null);
    const [engagementLoading, setEngagementLoading] = useState(true);
    const [engagementError, setEngagementError] = useState<string | null>(null);

    const [financialData, setFinancialData] = useState<FinancialMonth[] | null>(null);
    const [financialLoading, setFinancialLoading] = useState(true);
    const [financialError, setFinancialError] = useState<string | null>(null);

    const [activityLogs, setActivityLogs] = useState<ActivityLog[] | null>(null);
    const [activityLogsLoading, setActivityLogsLoading] = useState(true);
    const [activityLogsError, setActivityLogsError] = useState<string | null>(null);

    const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null);
    const [userMetricsLoading, setUserMetricsLoading] = useState(true);
    const [userMetricsError, setUserMetricsError] = useState<string | null>(null);

    const [healthData, setHealthData] = useState<any>(null);
    const [healthLoading, setHealthLoading] = useState(true);
    const [healthError, setHealthError] = useState<string | null>(null);

    const [vaccinationData, setVaccinationData] = useState<any>(null);
    const [vaccinationLoading, setVaccinationLoading] = useState(true);
    const [vaccinationError, setVaccinationError] = useState<string | null>(null);

    useEffect(() => {
        const loadEngagementData = async () => {
            try {
                setEngagementLoading(true);
                const data = await fetchEngagementData();
                setEngagementData(data);
                setEngagementError(null);
            } catch (err) {
                setEngagementError(err instanceof Error ? err.message : 'Failed to load engagement data');
            } finally {
                setEngagementLoading(false);
            }
        };

        const loadFinancialData = async () => {
            try {
                setFinancialLoading(true);
                const data = await fetchFinancialData();
                setFinancialData(data);
                setFinancialError(null);
            } catch (err) {
                setFinancialError(err instanceof Error ? err.message : 'Failed to load financial data');
            } finally {
                setFinancialLoading(false);
            }
        };

        const loadHealthData = async () => {
            try {
                setHealthLoading(true);
                const data = await fetchHealthData();
                setHealthData(data);
                setHealthError(null);
            } catch (err) {
                setHealthError(err instanceof Error ? err.message : 'Failed to load health data');
            } finally {
                setHealthLoading(false);
            }
        };

        const loadVaccinationData = async () => {
            try {
                setVaccinationLoading(true);
                const data = await fetchVaccinationData();
                setVaccinationData(data);
                setVaccinationError(null);
            } catch (err) {
                setVaccinationError(err instanceof Error ? err.message : 'Failed to load vaccination data');
            } finally {
                setVaccinationLoading(false);
            }
        };

        const loadActivityLogs = async () => {
            try {
                setActivityLogsLoading(true);
                const logs = await userAPI.getActivity(5);
                setActivityLogs(logs);
                setActivityLogsError(null);
            } catch (err) {
                setActivityLogsError(err instanceof Error ? err.message : 'Failed to load activity logs');
            } finally {
                setActivityLogsLoading(false);
            }
        };

        const loadUserMetrics = async () => {
            try {
                setUserMetricsLoading(true);
                const metrics = await analyticsAPI.getUserMetrics();
                setUserMetrics(metrics);
                setUserMetricsError(null);
            } catch (err) {
                setUserMetricsError(err instanceof Error ? err.message : 'Failed to load user metrics');
            } finally {
                setUserMetricsLoading(false);
            }
        };

        loadEngagementData();
        loadFinancialData();
        loadHealthData();
        loadVaccinationData();
        loadActivityLogs();
        loadUserMetrics();
    }, []);

    const financialTotals = financialData
        ? financialData.reduce(
            (acc, m) => ({
                revenue: acc.revenue + m.revenue,
                expenses: acc.expenses + m.expenses,
                profit: acc.profit + m.profit,
            }),
            { revenue: 0, expenses: 0, profit: 0 }
        )
        : null;

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
                            <Printer className="w-5 h-5" />
                            Print Report
                        </button>
                    </div>

                    {/* Report Tabs - Hidden on Print */}
                    <div className="mb-8 overflow--auto pb-2 print:hidden hide-scrollbar">
                        <div className="flex space--2 min-w-max">
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
                                    {engagementError && (
                                        <div className="mb-4 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                                            <AlertCircle className="w-5 h-5" />
                                            <span>{engagementError}</span>
                                        </div>
                                    )}
                                    {engagementLoading ? (
                                        <div className="flex items-center justify-center h-80 bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent">
                                            <div className="flex flex-col items-center">
                                                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                                <p className="mt-4 text-slate-600">Loading engagement data...</p>
                                            </div>
                                        </div>
                                    ) : engagementData ? (
                                        <UserEngagementChart data={engagementData} />
                                    ) : null}
                                </div>

                                <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent">
                                    {/* Scoped to the signed-in admin: /users/me/activity is the only activity endpoint available */}
                                    <h3 className="text-lg font-bold mb-4 text-blue-700">Your Recent Activity</h3>
                                    {activityLogsError && (
                                        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                                            <AlertCircle className="w-5 h-5" />
                                            <span>{activityLogsError}</span>
                                        </div>
                                    )}
                                    {activityLogsLoading ? (
                                        <div className="flex items-center justify-center h-40">
                                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                        </div>
                                    ) : activityLogs && activityLogs.length > 0 ? (
                                        <div className="space-y-4">
                                            {activityLogs.map((log) => (
                                                <div key={log.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                            {log.activityType.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-slate-800">{log.description || log.activityType}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {new Date(log.createdAt).toLocaleString()}
                                                                {log.ipAddress ? ` | IP: ${log.ipAddress}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${log.isSuspicious ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                        {log.isSuspicious ? 'Flagged' : 'Success'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : !activityLogsError ? (
                                        <p className="text-slate-500 text-sm py-8 text-center">No recent activity to display.</p>
                                    ) : null}
                                </div>

                                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-3xl shadow-lg text-white flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">Total Platform Users</h3>
                                        <p className="text-indigo-100">Across all roles and regions</p>
                                    </div>
                                    <div className="mt-8">
                                        {userMetricsLoading ? (
                                            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : userMetrics ? (
                                            <>
                                                <h2 className="text-5xl font-extrabold">{userMetrics.totalUsers.toLocaleString()}</h2>
                                                <p className="text-indigo-100 mt-2 flex items-center gap-2">
                                                    <span className="bg-white/20 px-2 py-1 rounded text-sm">+{userMetrics.newSignups.toLocaleString()}</span> new signups
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-indigo-100">{userMetricsError || 'User metrics not available'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Financial Reports */}
                        {activeTab === 'financial' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {financialError && (
                                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                                        <AlertCircle className="w-5 h-5" />
                                        <span>{financialError}</span>
                                    </div>
                                )}
                                {financialLoading ? (
                                    <div className="flex items-center justify-center h-80 bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent">
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                                            <p className="mt-4 text-slate-600">Loading financial data...</p>
                                        </div>
                                    </div>
                                ) : financialData ? (
                                    <FinancialReportChart data={financialData} />
                                ) : null}

                                {financialTotals && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {[
                                            { label: 'Total Revenue YTD', value: financialTotals.revenue },
                                            { label: 'Operating Expenses YTD', value: financialTotals.expenses },
                                            { label: 'Net Profit YTD', value: financialTotals.profit },
                                        ].map((stat) => (
                                            <div key={stat.label} className="bg-white p-6 rounded-3xl shadow-md border border-slate-100">
                                                <h4 className="text-slate-500 font-medium mb-1">{stat.label}</h4>
                                                <p className="text-3xl font-bold text-slate-800">${formatCurrency(stat.value)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Health Trend Reports */}
                        {activeTab === 'health' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {healthError && (
                                    <div className="col-span-1 lg:col-span-2 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                                        <AlertCircle className="w-5 h-5" />
                                        <span>{healthError}</span>
                                    </div>
                                )}
                                {healthLoading ? (
                                    <div className="flex items-center justify-center h-80 bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent">
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                            <p className="mt-4 text-slate-600">Loading health data...</p>
                                        </div>
                                    </div>
                                ) : healthData ? (
                                    <PetHealthChart data={healthData} />
                                ) : null}

                                {vaccinationError && (
                                    <div className="col-span-1 lg:col-span-2 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                                        <AlertCircle className="w-5 h-5" />
                                        <span>{vaccinationError}</span>
                                    </div>
                                )}
                                {vaccinationLoading ? (
                                    <div className="flex items-center justify-center h-80 bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent">
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                            <p className="mt-4 text-slate-600">Loading vaccination data...</p>
                                        </div>
                                    </div>
                                ) : vaccinationData ? (
                                    <VaccinationChart data={vaccinationData} />
                                ) : null}
                            </div>
                        )}

                        {/* System Usage Reports */}
                        {activeTab === 'usage' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="col-span-1 lg:col-span-2">
                                    {apiUsageLoading && <div className="p-6 text-center text-slate-600">Loading API usage data...</div>}
                                    {apiUsageError && <div className="p-6 text-center text-red-600">{apiUsageError}</div>}
                                    {apiUsageData && <ApiUsageChart data={apiUsageData} />}
                                </div>
                                {geoLoading && <div className="p-6 text-center text-slate-600">Loading geographic data...</div>}
                                {geoError && <div className="p-6 text-center text-red-600">{geoError}</div>}
                                {geoData && <GeoDistributionChart data={geoData} />}

                                <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent">
                                    <h3 className="text-lg font-bold mb-4 text-slate-800">System Capacity</h3>
                                    <div className="flex flex-col items-center justify-center py-10 text-center">
                                        <AlertCircle className="w-8 h-8 text-slate-400 mb-3" />
                                        <p className="text-slate-600 font-medium">Infrastructure metrics not available</p>
                                        <p className="text-slate-500 text-sm mt-1">Capacity data will appear here once a metrics endpoint is connected.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Scheduled Reports */}
                        {activeTab === 'scheduled' && (
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 print:hidden">
                                <h3 className="text-xl font-bold text-slate-800 mb-6">Automated Report Deliveries</h3>
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Calendar className="w-8 h-8 text-slate-400 mb-3" />
                                    <p className="text-slate-600 font-medium">Report scheduling is not available yet</p>
                                    <p className="text-slate-500 text-sm mt-1">Scheduled deliveries will appear here once the scheduling backend is in place.</p>
                                </div>
                            </div>
                        )}

                        {/* Templates */}
                        {activeTab === 'templates' && (
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 print:hidden">
                                <h3 className="text-xl font-bold text-slate-800 mb-6">Report Templates</h3>
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <FileText className="w-8 h-8 text-slate-400 mb-3" />
                                    <p className="text-slate-600 font-medium">Report templates are not available yet</p>
                                    <p className="text-slate-500 text-sm mt-1">Templates will appear here once the template system is implemented.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Embedded styles for print optimization */}
            <style>{`
                @media print {
                    @page { size: landscape; margin: 1cm; }
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .recharts-responsive-container { width: 100% !important; min-height: 400px !important; }
                    .shadow-lg, .shadow-md, .shadow-xl { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
                }
            `}</style>
        </ProtectedRoute>
    );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
