import React, { useState, useMemo } from 'react';
import { LabResultItem } from '@/types/lab-results';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Syringe, Microscope,
  Droplets, Stethoscope, Bone, FlaskConical,
} from 'lucide-react';
import { SkeletonLine } from '@/components/Skeleton';

type SortKey = 'date' | 'name' | 'status';
type SortDir = 'asc' | 'desc';

interface ResultListProps {
  results: LabResultItem[];
  onSelectTest: (testName: string) => void;
  selectedTest: string | null;
  loading?: boolean;
}

const ITEMS_PER_PAGE = 10;

function getCategoryIcon(category: string) {
  switch (category) {
    case 'Blood Work': return <Droplets className="w-4 h-4 text-red-400" />;
    case 'Urinalysis': return <FlaskConical className="w-4 h-4 text-yellow-500" />;
    case 'Imaging': return <Stethoscope className="w-4 h-4 text-blue-400" />;
    case 'Cytology': return <Microscope className="w-4 h-4 text-purple-400" />;
    case 'Microbiology': return <Bone className="w-4 h-4 text-green-500" />;
    default: return <Syringe className="w-4 h-4 text-gray-400" />;
  }
}

function ResultListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2">
              <SkeletonLine width="45%" height="1.2rem" />
              <SkeletonLine width="25%" height="0.8rem" />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end gap-1">
                <SkeletonLine width="3rem" height="1.2rem" />
                <SkeletonLine width="5rem" height="0.7rem" />
              </div>
              <SkeletonLine width="1.5rem" height="1.5rem" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-gray-500 py-12 text-center bg-gray-50/80 rounded-2xl border border-dashed border-gray-200">
      <Microscope className="w-12 h-12 mx-auto mb-3 text-gray-300" />
      <p className="text-lg font-medium text-gray-400">No results found</p>
      <p className="text-sm text-gray-400 mt-1">Try a different category or upload new lab results.</p>
    </div>
  );
}

function ResultDetailPanel({ result }: { result: LabResultItem }) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Category</span>
          <p className="font-medium text-gray-800">{result.category}</p>
        </div>
        <div>
          <span className="text-gray-500">Date</span>
          <p className="font-medium text-gray-800">
            {new Date(result.date).toLocaleDateString(undefined, {
              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            })}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Value</span>
          <p className={`font-bold text-lg ${result.isAbnormal ? 'text-red-500' : 'text-gray-800'}`}>
            {result.value}
            {result.referenceRange?.unit && (
              <span className="text-sm font-normal text-gray-500 ml-1">{result.referenceRange.unit}</span>
            )}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Reference Range</span>
          {result.referenceRange ? (
            <p className="font-medium text-gray-800">
              {result.referenceRange.min} &ndash; {result.referenceRange.max} {result.referenceRange.unit}
            </p>
          ) : (
            <p className="text-gray-400">N/A</p>
          )}
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">Status</span>
          <div className="mt-1">
            {result.isAbnormal ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                <AlertCircle className="w-3.5 h-3.5" /> Abnormal &ndash; needs attention
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Normal
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultList({
  results, onSelectTest, selectedTest, loading = false,
}: ResultListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const arr = [...results];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
        case 'name': cmp = a.testName.localeCompare(b.testName); break;
        case 'status': cmp = Number(a.isAbnormal) - Number(b.isAbnormal); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [results, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc'); }
    setPage(1);
  };

  const handleClick = (result: LabResultItem) => {
    onSelectTest(result.testName);
    setExpandedId((prev) => (prev === result.id ? null : result.id));
  };

  if (loading) return <ResultListSkeleton />;
  if (results.length === 0) return <EmptyState />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
        <span>Sort by:</span>
        {(['date', 'name', 'status'] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`px-3 py-1 rounded-full border transition-colors ${
              sortKey === key
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {key === 'date' ? 'Date' : key === 'name' ? 'Test Name' : 'Status'}
            {sortKey === key && (
              <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        ))}
        <span className="ml-auto text-gray-400">{results.length} result{results.length !== 1 && 's'}</span>
      </div>

      {paginated.map((result) => {
        const isExpanded = expandedId === result.id;
        return (
          <div
            key={result.id}
            onClick={() => handleClick(result)}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              result.isAbnormal
                ? 'border-red-200 bg-red-50/40 hover:border-red-300'
                : isExpanded
                  ? 'border-blue-400 bg-blue-50 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-gray-50'
            }`}
            role="button" tabIndex={0} aria-expanded={isExpanded}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(result); } }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  {getCategoryIcon(result.category)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{result.testName}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{new Date(result.date).toLocaleDateString()}</span>
                    <span className="text-gray-300">&middot;</span>
                    <span className="truncate">{result.category}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex flex-col items-end">
                  <span className={`text-lg font-bold ${result.isAbnormal ? 'text-red-500' : 'text-gray-800'}`}>
                    {result.value}
                    {result.referenceRange?.unit && (
                      <span className="text-xs text-gray-500 ml-1">{result.referenceRange.unit}</span>
                    )}
                  </span>
                </div>
                {result.isAbnormal ? (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                )}
                <div className="text-gray-400">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </div>
            {isExpanded && <ResultDetailPanel result={result} />}
          </div>
        );
      })}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
