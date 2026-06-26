import { ArrowLeft, BarChart3, RefreshCw } from 'lucide-react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import WebVitalsDashboard from '@/components/Performance/WebVitalsDashboard';

export default function PerformancePage() {
  const [key, setKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Core Web Vitals</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Real User Monitoring</span>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-sm text-gray-500">
            Monitoring LCP, FID, CLS, TTFB, and INP metrics collected from real users.
            Metrics are reported on page load and page transitions.
          </p>
        </div>

        <WebVitalsDashboard key={key} />
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};
