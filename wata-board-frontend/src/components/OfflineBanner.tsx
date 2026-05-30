import { useEffect, useState } from 'react';
import { useConnectivity } from '../hooks/useConnectivity';

interface OfflineBannerProps {
  className?: string;
  showDetails?: boolean;
}

export function OfflineBanner({ className = '', showDetails = false }: OfflineBannerProps) {
  const { connectivity, offlineActions, checkConnectivity } = useConnectivity();
  const [dismissed, setDismissed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const queuedCount = offlineActions.length;
  const shouldShow = !dismissed && (connectivity.isOffline || queuedCount > 0);

  useEffect(() => {
    if (connectivity.isOffline || queuedCount > 0) {
      setDismissed(false);
    }
  }, [connectivity.isOffline, queuedCount]);

  useEffect(() => {
    if (connectivity.isOnline && queuedCount === 0) {
      const timer = window.setTimeout(() => setDismissed(true), 3000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [connectivity.isOnline, queuedCount]);

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    try {
      await checkConnectivity();
    } finally {
      setIsRetrying(false);
    }
  };

  const stateStyles = connectivity.isOffline
    ? 'bg-amber-500 border-amber-600 text-amber-950'
    : 'bg-sky-500 border-sky-600 text-sky-950';

  const message = connectivity.isOffline
    ? 'You are offline. Some actions will sync when your connection returns.'
    : `Back online. Syncing ${queuedCount} queued action${queuedCount === 1 ? '' : 's'}.`;

  if (!shouldShow) return null;

  return (
    <div
      className={`fixed top-3 left-3 right-3 z-50 pointer-events-none transition-all duration-300 ease-out ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`mx-auto flex max-w-3xl items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/20 pointer-events-auto ${stateStyles}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/30 text-xs font-bold">
            {connectivity.isOffline ? '!' : '~'}
          </span>

          <div className="min-w-0">
            <p className="font-semibold leading-5">{message}</p>
            {showDetails && (
              <p className="mt-1 text-xs opacity-80">
                {connectivity.connectionType ? `Connection: ${connectivity.connectionType}. ` : ''}
                {connectivity.effectiveType ? `Speed: ${connectivity.effectiveType}. ` : ''}
                {connectivity.saveData ? 'Data saver is on.' : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {connectivity.isOffline && (
            <button
              type="button"
              onClick={handleRetryConnection}
              disabled={isRetrying}
              className="rounded-lg bg-white/25 px-3 py-1 text-xs font-semibold transition hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRetrying ? 'Checking' : 'Retry'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg px-2 py-1 text-sm font-bold transition hover:bg-white/25"
            aria-label="Dismiss offline status notification"
          >
            x
          </button>
        </div>
      </div>
    </div>
  );
}
