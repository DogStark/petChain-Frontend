import React from "react";
import { LabResultItem } from "@/types/lab-results";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ResultListProps {
  results: LabResultItem[];
  onSelectTest: (testName: string) => void;
  selectedTest: string | null;
}

export default function ResultList({
  results,
  onSelectTest,
  selectedTest,
}: ResultListProps) {
  if (results.length === 0) {
    return (
      <div className="text-gray-500 py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        No results found for this category.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((result) => {
        const isSelected = selectedTest === result.testName;
        return (
          <div
            key={result.id}
            onClick={() => onSelectTest(result.testName)}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              isSelected
                ? "border-blue-400 bg-blue-50 shadow-sm"
                : "border-gray-100 bg-white hover:border-blue-200 hover:bg-gray-50"
            }`}
          >
            {/* Left side: Test Info */}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800">{result.testName}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(result.date).toLocaleDateString()}
              </p>
            </div>

            {/* Right side: Values & Badges */}
            <div className="flex items-center gap-4 text-right">
              <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-xl font-bold ${result.isAbnormal ? "text-red-500" : "text-gray-800"}`}
                  >
                    {result.value}
                  </span>
                  {result.referenceRange?.unit && (
                    <span className="text-sm text-gray-500">
                      {result.referenceRange.unit}
                    </span>
                  )}
                </div>
                {result.referenceRange && (
                  <span className="text-xs text-gray-400">
                    Range: {result.referenceRange.min} -{" "}
                    {result.referenceRange.max}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center w-8">
                {result.isAbnormal ? (
                  <AlertCircle className="w-6 h-6 text-red-500" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
