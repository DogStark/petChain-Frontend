import React from 'react';

type RouteLoadingStateProps = {
  /** Accessible label announced to assistive tech while the route loads. */
  label?: string;
  /** Number of skeleton rows to render; keeps layout dimensions stable. */
  rows?: number;
  /** Optional error message. When present, a retry action is shown. */
  error?: string | null;
  /** Retry handler invoked when the user requests another attempt. */
  onRetry?: () => void;
};

/**
 * Route-level loading placeholder used by pet and medical pages.
 *
 * Renders a skeleton that mirrors the final content layout so the page does
 * not shift when data resolves, and exposes a recoverable error state with a
 * retry action.
 */
export default function RouteLoadingState({
  label = 'Loading…',
  rows = 3,
  error = null,
  onRetry,
}: RouteLoadingStateProps) {
  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="route-loading-state route-loading-state--error"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          minHeight: '12rem',
          padding: '1.5rem',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0 }}>{error}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className="route-loading-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        minHeight: '12rem',
        padding: '1.5rem',
      }}
    >
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="route-loading-state__row"
          style={{
            height: '1.25rem',
            borderRadius: '0.25rem',
            background: 'currentColor',
            opacity: 0.12,
            width: index === rows - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  );
}
