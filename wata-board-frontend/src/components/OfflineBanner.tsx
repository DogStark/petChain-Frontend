import React, { useEffect, useState } from 'react';
import { useConnectivity } from '../hooks/useConnectivity';

interface OfflineBannerProps {
  className?: string;
  showDetails?: boolean;
}

export function OfflineBanner({ className = '', showDetails = false }: OfflineBannerProps) {
  const { connectivity, offlineActions, checkConnectivity } = useConnectivity();
  const [isVisible, setIsVisible] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Show banner when offline or when there are queued actions
  useEffect(() => {
    setIsVisible(connectivity.isOffline || offlineActions.length > 0);
  }, [connectivity.isOffline, offlineActions.length]);

  // Auto-hide when coming back online and no queued actions
  useEffect(() => {
    if (connectivity.isOnline && offlineActions.length === 0) {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [connectivity.isOnline, offlineActions.length]);

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    try {
      await checkConnectivity();
    } finally {
      setIsRetrying(false);
    }
  };

  const getConnectionIcon = () => {
    if (connectivity.isOffline) {
      return '📱';
    }
    if (offlineActions.length > 0) {
      return '⏳';
    }
    return '🌐';
  };

  const getConnectionMessage = () => {
    if (connectivity.isOffline) {
      return 'You are offline. Some features may not be available.';
    }
    if (offlineActions.length > 0) {
      return `Back online! Processing ${offlineActions.length} queued action${offlineActions.length === 1 ? '' : 's'}...`;
    }
    return 'Connection restored';
  };

  const getConnectionColor = () => {
    if (connectivity.isOffline) {
      return 'bg-amber-500 border-amber-600 text-amber-50';
    }
    if (offlineActions.length > 0) {
      return 'bg-sky-500 border-sky-600 text-sky-50';
    }
    return 'bg-green-500 border-green-600 text-green-50';
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50
        ${getConnectionColor()}
        border-b px-4 py-3 text-sm
        transition-all duration-300 ease-in-out
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-lg" aria-hidden="true">
            {getConnectionIcon()}
          </span>
          <div>
            <p className="font-medium">{getConnectionMessage()}</p>
            {showDetails && (
              <div className="mt-1 text-xs opacity-75">
                {connectivity.connectionType && (
                  <span>Connection: {connectivity.connectionType}</span>
                )}
                {connectivity.effectiveType && (
                  <span className="ml-2">Speed: {connectivity.effectiveType}</span>
                )}
                {connectivity.saveData && (
                  <span className="ml-2">Data saver: ON</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {connectivity.isOffline && (
            <button
              onClick={handleRetryConnection}
              disabled={isRetrying}
              className="
                px-3 py-1 text-xs font-medium
                bg-white/20 hover:bg-white/30
                rounded transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              aria-label="Retry connection"
            >
              {isRetrying ? 'Checking...' : 'Retry'}
            </button>
          )}

          <button
            onClick={() => setIsVisible(false)}
            className="
              p-1 text-xs hover:bg-white/10 rounded
              transition-colors
            "
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
