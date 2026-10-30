import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { Download, RefreshCw } from 'lucide-react';
import { generateAnalyticsData } from '../lib/analyticsUserData';
import { GetServerSideProps } from 'next';
import DataModeChart from '@/components/DataModeChart';
import AnalyticsExportPreview from '@/components/analytics/AnalyticsExportPreview';

const UserEngagementChart = dynamic(() => import('../components/analytics/UserEngagementChart'), {
  ssr: false,
});
const PetHealthChart = dynamic(() => import('../components/analytics/PetHealthChart'), {
  ssr: false,
});
const VaccinationChart = dynamic(() => import('../components/analytics/VaccinationChart'), {
  ssr: false,
});
const GeoDistributionChart = dynamic(() => import('../components/analytics/GeoDistributionChart'), {
  ssr: false,
});
const ApiUsageChart = dynamic(() => import('../components/analytics/ApiUsageChart'), {
  ssr: false,
});

interface AnalyticsData {
  engagementData: { date: string; activeUsers: number; newSignups: number }[];
  healthData: { name: string; value: number; color: string }[];
  vaccinationData: { month: string; compliant: number; nonCompliant: number }[];
  geoData: { region: string; users: number }[];
  apiUsageData: { time: string; requests: number; errors: number }[];
  timestamp: string;
}

const HEALTH_STATUS_COLORS: Record<string, string> = {
  healthy: '#166534',
  'chronic condition': '#92400e',
  critical: '#b91c1c',
  recovering: '#1d4ed8',
};
const HEALTH_FALLBACK_COLORS = ['#1d4ed8', '#166534', '#92400e', '#b91c1c', '#6b21a8', '#0e7490'];

function AccessibleDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <details className="mt-3 rounded-lg text-sm">
      <summary className="w-fit cursor-pointer rounded font-semibold text-blue-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900">
        View data table: {caption}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="border-b border-gray-500 px-3 py-2 font-bold text-gray-950">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-gray-50">
                  {row.map((cell, columnIndex) =>
                    columnIndex === 0 ? (
                      <th key={columnIndex} scope="row" className="border-b border-gray-400 px-3 py-2 font-semibold text-gray-950">
                        {cell}
                      </th>
                    ) : (
                      <td key={columnIndex} className="border-b border-gray-400 px-3 py-2 text-gray-900">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-3 py-2 text-gray-800">
                  No chart data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const AnalyticsPage = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const newData = await generateAnalyticsData();
      setData(newData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      setError('Analytics data could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Exporting goes through the privacy-aware preview dialog: it shows the
  // exact fields and date range, masks identifiers by default, and only
  // unmounts personal data once the backend authorises it.

  // Memoize each chart's data so unrelated charts skip re-renders when their
  // slice hasn't changed between 30s polls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const engagementData = useMemo(() => data?.engagementData ?? [], [JSON.stringify(data?.engagementData)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const healthData = useMemo(
    () =>
      (data?.healthData ?? []).map((entry, index) => ({
        ...entry,
        color:
          HEALTH_STATUS_COLORS[entry.name.trim().toLowerCase()] ??
          HEALTH_FALLBACK_COLORS[index % HEALTH_FALLBACK_COLORS.length],
      })),
    [JSON.stringify(data?.healthData)],
  );
  const totalHealthPets = healthData.reduce((sum, entry) => sum + entry.value, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vaccinationData = useMemo(() => data?.vaccinationData ?? [], [JSON.stringify(data?.vaccinationData)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geoData = useMemo(() => data?.geoData ?? [], [JSON.stringify(data?.geoData)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const apiUsageData = useMemo(() => data?.apiUsageData ?? [], [JSON.stringify(data?.apiUsageData)]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-xl font-medium text-gray-500">Loading Analytics...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div role="alert" className="text-xl font-medium text-red-800 mb-4">
            {error}
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-white font-semibold hover:bg-red-700 transition-all duration-300"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
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
            <h1 className="text-3xl md:text-4xl font-extrabold text-blue-700 drop-shadow-sm">
              Analytics Dashboard
            </h1>
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
              onClick={() => setExportPreviewOpen(true)}
              className="flex items-center cursor-pointer justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 md:py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Export Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
          <section className="lg:col-span-8" aria-label="User engagement analytics">
            <DataModeChart
              title="User Engagement"
              summary={`${engagementData[engagementData.length - 1]?.activeUsers || 0} active users today`}
              minHeight="400px"
            >
              <UserEngagementChart data={engagementData} />
            </DataModeChart>
            <AccessibleDataTable
              caption="User engagement"
              columns={['Date', 'Active users', 'New signups']}
              rows={engagementData.map((entry) => [entry.date, entry.activeUsers, entry.newSignups])}
            />
          </section>

          <section className="lg:col-span-4" aria-label="Pet health analytics">
            <DataModeChart
              title="Pet Health Overview"
              priority={true}
              minHeight="400px"
            >
              <PetHealthChart data={healthData} />
            </DataModeChart>
            <AccessibleDataTable
              caption="Pet health distribution"
              columns={['Health status', 'Pets', 'Share']}
              rows={healthData.map((entry) => [
                entry.name,
                entry.value,
                `${(totalHealthPets ? (entry.value / totalHealthPets) * 100 : 0).toFixed(0)}%`,
              ])}
            />
          </section>

          <section className="lg:col-span-6" aria-label="Vaccination analytics">
            <DataModeChart
              title="Vaccination Compliance"
              priority={true}
              summary="Track vaccination status across your pets"
              minHeight="350px"
            >
              <VaccinationChart data={vaccinationData} />
            </DataModeChart>
            <AccessibleDataTable
              caption="Vaccination compliance"
              columns={['Month', 'Compliant (%)', 'Non-compliant (%)']}
              rows={vaccinationData.map((entry) => [entry.month, entry.compliant, entry.nonCompliant])}
            />
          </section>

          <section className="lg:col-span-6" aria-label="Geographic analytics">
            <DataModeChart
              title="Geographic Distribution"
              summary="User distribution across regions"
              minHeight="350px"
            >
              <GeoDistributionChart data={geoData} />
            </DataModeChart>
            <AccessibleDataTable
              caption="Geographic distribution"
              columns={['Region', 'Users']}
              rows={geoData.map((entry) => [entry.region, entry.users])}
            />
          </section>

          <section className="lg:col-span-12" aria-label="API usage analytics">
            <DataModeChart
              title="API Usage & Performance"
              summary="Monitor system requests and error rates"
              minHeight="300px"
            >
              <ApiUsageChart data={apiUsageData} />
            </DataModeChart>
            <AccessibleDataTable
              caption="API usage"
              columns={['Time', 'Requests', 'Errors']}
              rows={apiUsageData.map((entry) => [entry.time, entry.requests, entry.errors])}
            />
          </section>
        </div>
      </div>

      <AnalyticsExportPreview
        isOpen={exportPreviewOpen}
        onClose={() => setExportPreviewOpen(false)}
        data={data}
      />
      <style jsx global>{`
        .analytics-chart .recharts-cartesian-grid line {
          stroke: #9ca3af !important;
        }
        .analytics-chart .recharts-cartesian-axis-tick-value {
          fill: #374151 !important;
        }
        .analytics-chart .recharts-cartesian-axis-line,
        .analytics-chart .recharts-cartesian-axis-tick-line {
          stroke: #6b7280 !important;
        }
        .analytics-chart .recharts-legend-item-text,
        .analytics-chart .recharts-tooltip-item {
          color: #111827 !important;
        }
        .analytics-chart--engagement .recharts-line-curve[stroke="#4f46e5"] {
          stroke: #3730a3 !important;
          stroke-width: 3px;
        }
        .analytics-chart--engagement .recharts-line-curve[stroke="#10b981"] {
          stroke: #166534 !important;
          stroke-width: 3px;
        }
        .analytics-chart--vaccination .recharts-rectangle[fill="#10b981"] {
          fill: #166534 !important;
        }
        .analytics-chart--vaccination .recharts-rectangle[fill="#ef4444"] {
          fill: #b91c1c !important;
        }
        .analytics-chart--geographic .recharts-rectangle[fill="#8884d8"] {
          fill: #1d4ed8 !important;
        }
        .analytics-chart--api .recharts-area-area[fill="#8884d8"] {
          fill: #1d4ed8 !important;
          stroke: #1d4ed8 !important;
        }
        .analytics-chart--api .recharts-area-area[fill="#ef4444"] {
          fill: #b91c1c !important;
          stroke: #b91c1c !important;
        }
        .analytics-chart--health .recharts-pie-label-text {
          fill: #111827 !important;
          stroke: #fff;
          stroke-width: 2px;
          paint-order: stroke;
        }
      `}</style>
    </div>
  );
};

export default AnalyticsPage;

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {},
  };
};
