'use client';

import { useRouter } from 'next/router';
import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import {
  generateCorrelationId,
  redactCorrelationId,
  recordErrorDiagnostic,
  getErrorDiagnostics,
  type RouteGroup,
} from '@/lib/errorCorrelation';


// ─── Types ────────────────────────────────────────────────────────────────────

export interface RouteErrorBoundaryProps {
  /** Coarse route group used for correlation IDs. Never a full URL. */
  routeGroup?: RouteGroup;
  /** Human name of the segment, shown in dev builds only. */
  segmentName?: string;
  /**
   * Render override for tests/custom fallbacks. Receives the state and a
   * `reset` callback that recovers without a full page reload.
   */
  fallback?: (state: RouteErrorBoundaryState, reset: () => void) => ReactNode;
  children: ReactNode;
}

export interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  correlationId: string;
  retryCount: number;
}

const isDev = process.env.NODE_ENV !== 'production';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Route-level error boundary.
 *
 * Catches render exceptions inside a route segment and shows a safe fallback
 * with a redacted correlation ID. "Try again" resets only this boundary's
 * subtree — sibling boundaries and completed mutations are untouched.
 * The heading receives focus on failure so keyboard users land on the error
 * instead of a dead page.
 */
export default class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  private headingRef = React.createRef<HTMLHeadingElement>();

  public state: RouteErrorBoundaryState = {
    hasError: false,
    error: null,
    correlationId: '',
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    // Each caught exception is a distinct incident with its own correlation ID.
    // This runs before componentDidCatch, so the ID is available in the first
    // fallback render and in diagnostics recording.
    return {
      hasError: true,
      error,
      correlationId: generateCorrelationId('server'),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const routeGroup = this.props.routeGroup ?? 'server';
    // getDerivedStateFromError is static and cannot read props, so it seeds a
    // placeholder group; correct the prefix here once the real group is known.
    let correlationId = redactCorrelationId(this.state.correlationId, routeGroup);
    if (!correlationId.startsWith(`ec-${routeGroup}-`)) {
      correlationId = generateCorrelationId(routeGroup);
      this.setState({ correlationId });
    }

     
    console.error('[RouteErrorBoundary]', { correlationId, routeGroup, error, errorInfo });

    recordErrorDiagnostic({
      correlationId,
      routeGroup,
      errorKind: error.name || 'Error',
      timestamp: new Date().toISOString(),
    });

    // Move keyboard focus to the fallback heading.
    // rAF: the fallback DOM must exist before focus can land on it.
    // Guarded for environments without rAF (older jsdom, SSR edge cases).
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.headingRef.current?.focus());
    } else {
      setTimeout(() => this.headingRef.current?.focus(), 0);
    }
  }

  /**
   * Recover without a full reload: clear the error state so React re-renders
   * only this boundary's subtree. Failed sibling segments and any mutations
   * that already completed are not re-run.
   */
  private handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  public render() {
    const { hasError, error, correlationId } = this.state;
    const { fallback, routeGroup = 'server', segmentName, children } = this.props;

    if (!hasError) return children;

    if (fallback) {
      return fallback(this.state, this.handleRetry);
    }

    const diagnosticsCount = getErrorDiagnostics().length;

    return (
      <div
        role="alert"
        className="min-h-[60vh] flex items-center justify-center px-4 py-12 bg-gray-50"
        data-testid={`route-error-${routeGroup}`}
      >
        <div className="w-full max-w-md bg-white border border-red-100 rounded-lg shadow-sm p-8 text-center">
          <div
            aria-hidden="true"
            className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4"
          >
            <span className="text-red-600 text-2xl font-bold">⚠</span>
          </div>

          <h2
            ref={this.headingRef}
            tabIndex={-1}
            className="text-xl font-bold text-gray-900 mb-2 focus:outline-none"
          >
            Something went wrong
          </h2>

          <p className="text-sm text-gray-600 mb-6">
            This part of the page failed to load. Your data is safe — you can retry without
            losing your progress.
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Try again
            </button>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            Reference: <code className="font-mono select-all">{correlationId}</code>
            <span className="sr-only">
              Share this reference with support. It contains no personal data.
            </span>
          </p>

          {isDev && (
            <div className="mt-4 text-left bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-600">
              <p className="font-semibold mb-1">
                [dev] Segment: {segmentName ?? routeGroup} · Diagnostics buffered: {diagnosticsCount}
              </p>
              {error && <pre className="whitespace-pre-wrap break-words text-[10px]">{error.message}</pre>}
            </div>
          )}
        </div>
      </div>
    );
  }
}

// ─── Router-connected wrapper ─────────────────────────────────────────────────

/**
 * Wraps a page subtree in a boundary whose identity follows the route.
 * Remounting on `asPath` forces a fresh boundary per navigation, so an error
 * on one page never bleeds into the next.
 */
export function RouteErrorBoundaryWithRouter(props: Omit<RouteErrorBoundaryProps, 'routeGroup'>) {
  const { asPath } = useRouter();
  const routeGroup: RouteGroup = asPath.startsWith('/dashboard') ||
    asPath.startsWith('/wallet') ||
    asPath.startsWith('/pets') ||
    asPath.startsWith('/admin') ||
    asPath.startsWith('/sessions') ||
    asPath.startsWith('/account-settings') ||
    asPath.startsWith('/profile') ||
    asPath.startsWith('/appointments') ||
    asPath.startsWith('/scan')
    ? 'protected'
    : 'public';

  return (
    <RouteErrorBoundary
      key={asPath}
      routeGroup={routeGroup}
      segmentName={asPath}
      {...props}
    />
  );
}
