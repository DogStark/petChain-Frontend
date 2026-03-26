import React, { useState } from "react";
import CategoryTabs from "./CategoryTabs";
import ResultList from "./ResultList";
import UploadModal from "./UploadModal";
import ShareModal from "./ShareModal";
import TrendsChart from "./TrendsChart";
import { LabCategory, LabResultItem } from "@/types/lab-results";
import { Share2, UploadCloud } from "lucide-react";

// Mock Data
const MOCK_RESULTS: LabResultItem[] = [
  {
    id: "1",
    testName: "White Blood Cell Count",
    value: 12.5,
    category: "Blood Work",
    date: "2023-10-15T10:00:00Z",
    referenceRange: { min: 5.5, max: 16.9, unit: "K/uL" },
    isAbnormal: false,
  },
  {
    id: "2",
    testName: "Red Blood Cell Count",
    value: 4.8,
    category: "Blood Work",
    date: "2023-10-15T10:00:00Z",
    referenceRange: { min: 5.5, max: 8.5, unit: "M/uL" },
    isAbnormal: true,
  },
  {
    id: "3",
    testName: "Hemoglobin",
    value: 13.2,
    category: "Blood Work",
    date: "2023-10-15T10:00:00Z",
    referenceRange: { min: 12.0, max: 18.0, unit: "g/dL" },
    isAbnormal: false,
  },
  {
    id: "4",
    testName: "Urine Specific Gravity",
    value: 1.045,
    category: "Urinalysis",
    date: "2023-10-16T10:00:00Z",
    referenceRange: { min: 1.015, max: 1.05, unit: "" },
    isAbnormal: false,
  },
  {
    id: "5",
    testName: "Urine Protein",
    value: "2+",
    category: "Urinalysis",
    date: "2023-10-16T10:00:00Z",
    isAbnormal: true,
  },

  // Historical data for charts
  {
    id: "6",
    testName: "Red Blood Cell Count",
    value: 5.9,
    category: "Blood Work",
    date: "2023-04-10T10:00:00Z",
    referenceRange: { min: 5.5, max: 8.5, unit: "M/uL" },
    isAbnormal: false,
  },
  {
    id: "7",
    testName: "Red Blood Cell Count",
    value: 5.1,
    category: "Blood Work",
    date: "2022-10-15T10:00:00Z",
    referenceRange: { min: 5.5, max: 8.5, unit: "M/uL" },
    isAbnormal: true,
  },
];

const CATEGORIES: LabCategory[] = [
  "Blood Work",
  "Urinalysis",
  "Imaging",
  "Cytology",
  "Microbiology",
  "Other",
];

export default function ResultsDashboard() {
  const [activeCategory, setActiveCategory] =
    useState<LabCategory>("Blood Work");
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  const [selectedTestTrend, setSelectedTestTrend] = useState<string | null>(
    "Red Blood Cell Count",
  );

  const filteredResults = MOCK_RESULTS.filter(
    (r) => r.category === activeCategory,
  );

  // Group results to find latest for list, and historical for chart
  const latestResultsMap = new Map<string, LabResultItem>();
  filteredResults.forEach((r) => {
    const existing = latestResultsMap.get(r.testName);
    if (!existing || new Date(r.date) > new Date(existing.date)) {
      latestResultsMap.set(r.testName, r);
    }
  });
  const latestResultsList = Array.from(latestResultsMap.values());

  const historicalDataForSelectedTest = selectedTestTrend
    ? MOCK_RESULTS.filter((r) => r.testName === selectedTestTrend).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/60 p-4 rounded-2xl shadow-sm border border-white/40">
        <CategoryTabs
          categories={CATEGORIES}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShareModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pink-100 text-pink-700 font-semibold rounded-full hover:bg-pink-200 transition-colors"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
          >
            <UploadCloud className="w-4 h-4" /> Upload Results
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-blue-50">
            <h2 className="text-xl font-bold text-blue-800 mb-4">
              {activeCategory} Results
            </h2>
            <ResultList
              results={latestResultsList}
              onSelectTest={setSelectedTestTrend}
              selectedTest={selectedTestTrend}
            />
          </div>
        </div>

        {/* Right Column: Trends Overview */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-pink-50 sticky top-4">
            <h2 className="text-xl font-bold text-blue-800 mb-2">
              Trend Analysis
            </h2>
            {selectedTestTrend ? (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  Showing history for <strong>{selectedTestTrend}</strong>
                </p>
                <TrendsChart data={historicalDataForSelectedTest} />
              </>
            ) : (
              <div className="text-center py-10 text-gray-400">
                Select a test from the list to view its trend history.
              </div>
            )}
          </div>
        </div>
      </div>

      {isUploadModalOpen && (
        <UploadModal onClose={() => setUploadModalOpen(false)} />
      )}
      {isShareModalOpen && (
        <ShareModal onClose={() => setShareModalOpen(false)} />
      )}
    </div>
  );
}
