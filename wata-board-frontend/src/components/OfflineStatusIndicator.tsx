import React from 'react';
import { useConnectivity } from '../hooks/useConnectivity';

interface OfflineStatusIndicatorProps {
  className?: string;
  showText?: boolean;
  variant?: 'banner' | 'badge' | 'compact';
}

export function OfflineStatusIndicator({ 
  className = '', 
  showText = true,
  variant = 'badge' 
}: OfflineStatusIndicatorProps) {
  const { connectivity, offlineActions } = useConnectivity();

  const getStatusColor = () => {
    if (connectivity.isOffline) return 'text-amber-600 bg-amber-50 border-amber-200';
    if (offlineActions.length > 0) return 'text-sky-600 bg-sky-50 border-sky-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStatusIcon = () => {
    if (connectivity.isOffline) return '📱';
    if (offlineActions.length > 0) return '⏳';
    return '🌐';
  };

  const getStatusText = () => {
    if (connectivity.isOffline) return 'Offline';
    if (offlineActions.length > 0) return `Syncing (${offlineActions.length})`;
    return 'Online';
  };

  const getStatusAriaLabel = () => {
    if (connectivity.isOffline) return 'Currently offline - some features may not be available';
    if (offlineActions.length > 0) return `Back online - processing ${offlineActions.length} queued actions`;
    return 'Connected to internet';
  };

  if (variant === 'compact') {
    return (
      <div
        className={`
          inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border
          ${getStatusColor()}
          ${className}
        `}
        role="status"
        aria-label={getStatusAriaLabel()}
      >
        <span aria-hidden="true">{getStatusIcon()}</span>
        {showText && <span>{getStatusText()}</span>}
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        className={`
          w-full px-3 py-2 rounded-lg border text-sm font-medium
          ${getStatusColor()}
          ${className}
        `}
        role="status"
        aria-live="polite"
        aria-label={getStatusAriaLabel()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span aria-hidden="true">{getStatusIcon()}</span>
            <span>{getStatusText()}</span>
          </div>
          {offlineActions.length > 0 && (
            <span className="text-xs opacity-75">
              {offlineActions.length} pending
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default badge variant
  return (
    <div
      className={`
        inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium border
        ${getStatusColor()}
        ${className}
      `}
      role="status"
      aria-label={getStatusAriaLabel()}
    >
      <span aria-hidden="true" className="text-base">{getStatusIcon()}</span>
      {showText && (
        <>
          <span>{getStatusText()}</span>
          {offlineActions.length > 0 && (
            <span className="text-xs opacity-75">
              ({offlineActions.length})
            </span>
          )}
        </>
      )}
    </div>
  );
}
