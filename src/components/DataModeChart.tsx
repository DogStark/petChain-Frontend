'use client';

import { useState, ReactNode } from 'react';
import { BarChart3, Eye } from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';

interface DataModeChartProps {
  children: ReactNode;
  /**
   * Priority charts (emergency, critical care indicators) always render
   */
  priority?: boolean;
  /**
   * Title of the chart for accessibility and simplified view
   */
  title: string;
  /**
   * Optional simplified text summary for reduced mode
   */
  summary?: string;
  /**
   * Minimum height for the chart container
   */
  minHeight?: string | number;
}

/**
 * Chart wrapper that respects reduced-data mode.
 * 
 * In reduced mode:
 * - Non-priority charts show a summary or "View Chart" button
 * - Priority charts (emergency indicators) render immediately
 * - User can opt-in to view specific charts
 * - Simplified summaries provided when available
 * 
 * Accessibility:
 * - Summary text available to screen readers
 * - View buttons keyboard accessible
 * - Proper semantic structure maintained
 */
export default function DataModeChart({
  children,
  priority = false,
  title,
  summary,
  minHeight = '300px',
}: DataModeChartProps) {
  const { isReducedMode } = useDataMode();
  const [userOptedIn, setUserOptedIn] = useState(false);

  const shouldRender = !isReducedMode || priority || userOptedIn;

  const handleViewChart = () => {
    setUserOptedIn(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleViewChart();
    }
  };

  if (!shouldRender) {
    return (
      <div
        className="bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-2xl p-6 border border-gray-200 shadow-sm"
        style={{ minHeight }}
        role="region"
        aria-label={`${title} chart (deferred to save bandwidth)`}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <BarChart3 className="w-12 h-12 text-blue-400 mb-3" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
          
          {summary && (
            <p className="text-sm text-gray-600 text-center max-w-md mb-4">
              {summary}
            </p>
          )}
          
          <button
            onClick={handleViewChart}
            onKeyDown={handleKeyDown}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            aria-label={`View ${title} chart`}
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
            View Chart
          </button>
          
          <p className="mt-3 text-xs text-gray-500 text-center">
            Reduced data mode • Click to load
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
