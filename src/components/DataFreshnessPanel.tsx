/**
 * DataFreshnessPanel
 *
 * Displays the last successful refresh time and data source for each of the
 * three dashboard data categories — Profile, Medical History, and Emergency —
 * and provides a per-category refresh button plus a "Refresh all" convenience
 * action.
 *
 * Accessibility:
 * - Every refresh button has an aria-label that identifies the category.
 * - Spinning icons carry aria-hidden so screen readers only hear the label.
 * - Status text and error messages use role="status" / role="alert" so they
 *   are announced without requiring focus.
 * - The panel itself is a <section> with an aria-labelledby heading so it
 *   integrates cleanly into the page landmark structure.
 * - All interactive controls are keyboard-operable (native <button>s).
 */

import React, { useId } from 'react';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Server } from 'lucide-react';
import type { CategoryFreshness, DataCategory } from '@/hooks/useDataFreshness';

// ---------------------------------------------------------------------------
// Time-ago helper (self-contained to avoid pulling in a library)
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** 10 minutes — data older than this is considered stale */
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

function isStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > STALE_THRESHOLD_MS;
}

// ---------------------------------------------------------------------------
// Category display metadata
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<DataCategory, string> = {
  profile: 'Profile',
  medicalHistory: 'Medical History',
  emergency: 'Emergency',
};

const CATEGORY_ICONS: Record<DataCategory, string> = {
  profile: '👤',
  medicalHistory: '📋',
  emergency: '🚨',
};

// ---------------------------------------------------------------------------
// Sub-component: single category row
// ---------------------------------------------------------------------------

interface CategoryRowProps {
  category: DataCategory;
  state: CategoryFreshness;
  onRefresh: (category: DataCategory) => void;
}

function CategoryRow({ category, state, onRefresh }: CategoryRowProps) {
  const { lastRefreshedAt, isRefreshing, error, source } = state;
  const stale = lastRefreshedAt ? isStale(lastRefreshedAt) : false;

  const label = CATEGORY_LABELS[category];
  const icon = CATEGORY_ICONS[category];

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-b-0">
      {/* Left: icon + category name + meta */}
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-lg mt-0.5" aria-hidden="true">
          {icon}
        </span>

        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{label}</p>

          {/* Source */}
          <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            <Server className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{source}</span>
          </p>

          {/* Freshness / error */}
          {error ? (
            <p
              role="alert"
              className="flex items-center gap-1 text-xs text-red-600 mt-1 font-medium"
            >
              <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : (
            <p
              role="status"
              className={`flex items-center gap-1 text-xs mt-1 ${
                lastRefreshedAt
                  ? stale
                    ? 'text-amber-600 font-medium'
                    : 'text-green-600'
                  : 'text-gray-400'
              }`}
            >
              {lastRefreshedAt ? (
                stale ? (
                  <>
                    <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                    Stale · {timeAgo(lastRefreshedAt)}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                    Updated {timeAgo(lastRefreshedAt)}
                  </>
                )
              ) : (
                <>
                  <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                  Never refreshed
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Right: refresh button */}
      <button
        type="button"
        onClick={() => onRefresh(category)}
        disabled={isRefreshing}
        aria-label={
          isRefreshing ? `Refreshing ${label} data…` : `Refresh ${label} data`
        }
        className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 ${
          isRefreshing
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200'
        }`}
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface DataFreshnessPanelProps {
  freshness: Record<DataCategory, CategoryFreshness>;
  onRefresh: (category: DataCategory) => void;
  onRefreshAll: () => void;
  /** Whether any category is currently refreshing (used to disable "Refresh all") */
  isAnyRefreshing?: boolean;
}

export default function DataFreshnessPanel({
  freshness,
  onRefresh,
  onRefreshAll,
  isAnyRefreshing = false,
}: DataFreshnessPanelProps) {
  const headingId = useId();
  const categories: DataCategory[] = ['profile', 'medicalHistory', 'emergency'];

  return (
    <section
      aria-labelledby={headingId}
      className="bg-white shadow rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h2 id={headingId} className="text-base font-semibold text-gray-900">
          Data Freshness
        </h2>
        <button
          type="button"
          onClick={onRefreshAll}
          disabled={isAnyRefreshing}
          aria-label={
            isAnyRefreshing ? 'Refreshing all data…' : 'Refresh all dashboard data'
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 ${
            isAnyRefreshing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isAnyRefreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isAnyRefreshing ? 'Refreshing…' : 'Refresh all'}
        </button>
      </div>

      {/* Category rows */}
      <div className="px-6 py-2">
        {categories.map((cat) => (
          <CategoryRow
            key={cat}
            category={cat}
            state={freshness[cat]}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </section>
  );
}
