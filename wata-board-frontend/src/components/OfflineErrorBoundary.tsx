import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getOfflineErrorMessage, shouldShowOfflineUI } from '../utils/offlineApi';

interface OfflineErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
}

interface OfflineErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  isOnline: boolean;
}

export class OfflineErrorBoundary extends Component<OfflineErrorBoundaryProps, OfflineErrorBoundaryState> {
  constructor(props: OfflineErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<OfflineErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    console.error('[OfflineErrorBoundary] Error caught:', error, errorInfo);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  private handleOnline = () => {
    this.setState({ isOnline: true });

    if (this.state.hasError && this.state.error && shouldShowOfflineUI(this.state.error)) {
      this.handleRetry();
    }
  };

  private handleOffline = () => {
    this.setState({ isOnline: false });
  };

  private handleRetry = () => {
    this.props.onRetry?.();
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const error = this.state.error;
    const isOfflineError = error ? shouldShowOfflineUI(error) : false;

    if (!isOfflineError && error) {
      throw error;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const errorMessage = error ? getOfflineErrorMessage(error) : 'Connection interrupted. Please try again.';

    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <section
          className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl"
          aria-labelledby="offline-error-title"
          role="alert"
        >
          <div className="text-center">
            <div className="text-4xl mb-4" aria-hidden="true">
              !
            </div>

            <h1 id="offline-error-title" className="text-xl font-semibold mb-2">
              Connection Issue
            </h1>

            <p className="text-slate-300 mb-6 text-sm">{errorMessage}</p>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-6">
              <p className="text-amber-300 text-xs">
                {this.state.isOnline
                  ? 'Your connection is back. Retry to continue where you left off.'
                  : "You're offline. Actions that support offline sync will be saved and completed when you reconnect."}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="w-full bg-sky-500 hover:bg-sky-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Try Again
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Refresh Page
              </button>
            </div>

            {import.meta.env.DEV && error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs text-red-400 bg-slate-950 p-2 rounded overflow-auto">
                  {error.stack}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </section>
      </div>
    );
  }
}
