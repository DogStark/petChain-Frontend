import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, FlaskConical, CalendarDays, TrendingUp, ArrowRight, Share2, UploadCloud } from 'lucide-react';
import { LabCategory, LabResultItem } from '@/types/lab-results';
import { useLabResults } from '@/hooks/useLabResults';
import CategoryTabs from './CategoryTabs';
import ResultList from './ResultList';
import TrendsChart from './TrendsChart';
import UploadModal from './UploadModal';
import ShareModal from './ShareModal';

const CATEGORIES: LabCategory[] = [
  'Blood Work',
  'Urinalysis',
  'Imaging',
  'Cytology',
  'Microbiology',
  'Other',
];

// ── Summary stat card ────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className={`flex items-center gap-4 bg-white rounded-3xl p-5 shadow-sm border ${accent}`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-blue-800 leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ── Alert banner for abnormal results ────────────────────────────────────────
function AbnormalAlert({ items }: { items: LabResultItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-red-700 text-sm">
          {items.length} abnormal result{items.length > 1 ? 's' : ''} detected
        </p>
        <p className="text-xs text-red-500 mt-0.5">
          {items.map((r) => r.testName).join(', ')}
        </p>
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-3xl skeleton-shimmer" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-3xl skeleton-shimmer" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ResultsDashboard({ petId }: { petId?: string }) {
  const { results, summary, recentResults, loading, error } = useLabResults(petId);

  const [activeCategory, setActiveCategory] = useState<LabCategory>('Blood Work');
  const [selectedTestTrend, setSelectedTestTrend] = useState<string | null>('Red Blood Cell Count');
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isShareOpen, setShareOpen] = useState(false);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-gray-400">
        <FlaskConical className="w-12 h-12" />
        <p className="text-lg font-medium">No lab results yet</p>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors"
        >
          <UploadCloud className="w-4 h-4" /> Upload First Result
        </button>
        {isUploadOpen && <UploadModal onClose={() => setUploadOpen(false)} />}
      </div>
    );
  }

  const abnormalRecent = recentResults.filter((r) => r.isAbnormal);

  // Latest unique results per test name for the active category
  const filteredResults = results.filter((r) => r.category === activeCategory);
  const latestMap = new Map<string, LabResultItem>();
  filteredResults.forEach((r) => {
    const existing = latestMap.get(r.testName);
    if (!existing || new Date(r.date) > new Date(existing.date)) latestMap.set(r.testName, r);
  });
  const latestResultsList = Array.from(latestMap.values());

  const trendData = selectedTestTrend
    ? results
        .filter((r) => r.testName === selectedTestTrend)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  const mostRecentFormatted = summary.mostRecentDate
    ? new Date(summary.mostRecentDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  return (
    <div className="flex flex-col gap-6">
      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<FlaskConical className="w-8 h-8 text-blue-500" />}
          label="Total Results"
          value={summary.total}
          accent="border-blue-100"
        />
        <StatCard
          icon={
            summary.abnormalCount > 0 ? (
              <AlertCircle className="w-8 h-8 text-red-500" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            )
          }
          label="Abnormal Findings"
          value={summary.abnormalCount}
          accent={summary.abnormalCount > 0 ? 'border-red-100' : 'border-green-100'}
        />
        <StatCard
          icon={<CalendarDays className="w-8 h-8 text-pink-500" />}
          label="Most Recent Test"
          value={mostRecentFormatted}
          accent="border-pink-100"
        />
      </div>

      {/* ── Abnormal alert banner ── */}
      <AbnormalAlert items={abnormalRecent} />

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/60 p-4 rounded-2xl shadow-sm border border-white/40">
        <CategoryTabs
          categories={CATEGORIES}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pink-100 text-pink-700 font-semibold rounded-full hover:bg-pink-200 transition-colors"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 shadow-md transition-all"
          >
            <UploadCloud className="w-4 h-4" /> Upload
          </button>
        </div>
      </div>

      {/* ── Main grid: results list + trend chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent results list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-blue-50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-blue-800">{activeCategory} Results</h2>
              <Link
                href="/lab-results"
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <ResultList
              results={latestResultsList}
              onSelectTest={setSelectedTestTrend}
              selectedTest={selectedTestTrend}
            />
          </div>
        </div>

        {/* Right: Trend chart */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-pink-50 sticky top-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-pink-500" />
              <h2 className="text-xl font-bold text-blue-800">Trend Analysis</h2>
            </div>
            {selectedTestTrend ? (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  History for <strong>{selectedTestTrend}</strong>
                </p>
                <TrendsChart data={trendData} />
              </>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">
                Select a test from the list to view its trend.
              </div>
            )}
          </div>
        </div>
      </div>

      {isUploadOpen && <UploadModal onClose={() => setUploadOpen(false)} />}
      {isShareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
    </div>
  );
}
