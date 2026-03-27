import React, { Component, ReactNode } from 'react';
import { shouldShowOfflineUI, getOfflineErrorMessage } from '../utils/offlineApi';

interface OfflineErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface OfflineErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

export class OfflineErrorBoundary extends Component<OfflineErrorBoundaryProps, OfflineErrorBoundaryState> {
  constructor(props: OfflineErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): OfflineErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error for debugging
    console.error('[OfflineErrorBoundary] Error caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const isOfflineError = error ? shouldShowOfflineUI(error) : false;
      const errorMessage = error ? getOfflineErrorMessage(error) : 'An unexpected error occurred';

      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="text-center">
              <div className="text-4xl mb-4">
                {isOfflineError ? '📱' : '⚠️'}
              </div>
              
              <h1 className="text-xl font-semibold mb-2">
                {isOfflineError ? 'Connection Issue' : 'Something went wrong'}
              </h1>
              
              <p className="text-slate-300 mb-6 text-sm">
                {errorMessage}
              </p>

              {isOfflineError && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-6">
                  <p className="text-amber-300 text-xs">
                    Your actions will be saved and completed automatically when you're back online.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-sky-500 hover:bg-sky-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Try Again
                </button>
                
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Refresh Page
                </button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs text-red-400 bg-slate-950 p-2 rounded overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
