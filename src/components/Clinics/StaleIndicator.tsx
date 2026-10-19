import React from "react";
import { Clock, WifiOff, RefreshCw } from "lucide-react";

interface StaleIndicatorProps {
  lastUpdated: Date | null;
  isOffline: boolean;
  isRefreshing: boolean;
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function isStale(date: Date): boolean {
  return Date.now() - date.getTime() > STALE_THRESHOLD_MS;
}

export default function StaleIndicator({
  lastUpdated,
  isOffline,
  isRefreshing,
}: StaleIndicatorProps) {
  if (!lastUpdated && !isOffline) return null;

  return (
    <div
      className="flex items-center gap-2 text-xs"
      role="status"
      aria-live="polite"
    >
      {isRefreshing && (
        <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" aria-hidden="true" />
      )}
      {isOffline ? (
        <span className="flex items-center gap-1.5 text-amber-600 font-medium">
          <WifiOff className="w-3 h-3" aria-hidden="true" />
          Offline — showing last-known data
          {lastUpdated && (
            <span className="text-amber-500">
              ({timeAgo(lastUpdated)})
            </span>
          )}
        </span>
      ) : lastUpdated ? (
        <span
          className={`flex items-center gap-1.5 ${
            isStale(lastUpdated)
              ? "text-amber-600 font-medium"
              : "text-gray-400"
          }`}
        >
          <Clock className="w-3 h-3" aria-hidden="true" />
          {isStale(lastUpdated) && (
            <span className="text-amber-600 font-semibold">Stale ·</span>
          )}
          Last updated {timeAgo(lastUpdated)}
        </span>
      ) : null}
    </div>
  );
}
