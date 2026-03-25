import { useConnectivity } from '../hooks/useConnectivity';

export interface OfflineApiOptions {
  enableQueue?: boolean;
  retryAttempts?: number;
  timeout?: number;
  fallbackData?: any;
}

export class OfflineApiError extends Error {
  public isOffline: boolean;
  public queuedActionId?: string;

  constructor(
    message: string,
    isOffline: boolean = false,
    queuedActionId?: string
  ) {
    super(message);
    this.name = 'OfflineApiError';
    this.isOffline = isOffline;
    this.queuedActionId = queuedActionId;
  }
}

// Offline-aware API wrapper
export function useOfflineApi() {
  const { connectivity, queueOfflineAction, checkConnectivity } = useConnectivity();

  // Make an offline-aware API call
  const apiCall = async (
    url: string,
    options: RequestInit = {},
    offlineOptions: OfflineApiOptions = {}
  ): Promise<Response> => {
    const {
      enableQueue = true,
      retryAttempts = 3,
      timeout = 10000
    } = offlineOptions;

    // Check connectivity first
    if (!connectivity.isOnline) {
      if (enableQueue && shouldQueueForOffline(url, options)) {
        const actionId = await queueForOffline(url, options);
        throw new OfflineApiError(
          'You are offline. The action has been queued and will be processed when you are back online.',
          true,
          actionId
        );
      }

      throw new OfflineApiError(
        'You are offline. This feature requires an internet connection.',
        true
      );
    }

    // Make the actual API call with retry logic
    return makeApiCallWithRetry(url, options, retryAttempts, timeout);
  };

  // Queue API call for offline processing
  const queueForOffline = async (url: string, options: RequestInit): Promise<string> => {
    const actionType = getActionType(url, options);
    const data = {
      url,
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      timestamp: Date.now(),
    };

    queueOfflineAction(actionType, data);
    return data.timestamp.toString();
  };

  // Make API call with retry logic
  const makeApiCallWithRetry = async (
    url: string,
    options: RequestInit,
    maxAttempts: number,
    timeout: number
  ): Promise<Response> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if response indicates server-side issues
        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }

        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) or aborts
        if (error instanceof Error &&
          (error.name === 'AbortError' ||
            (error.message.includes('400') || error.message.includes('401') || error.message.includes('403') || error.message.includes('404')))) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  };

  // Check if request should be queued for offline
  const shouldQueueForOffline = (url: string, _options: RequestInit): boolean => {
    const method = _options.method || 'GET';

    // Only queue POST/PUT/PATCH requests
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return false;
    }

    // Don't queue sensitive operations
    const sensitivePaths = ['/login', '/register', '/password-reset'];
    if (sensitivePaths.some(path => url.includes(path))) {
      return false;
    }

    return true;
  };

  // Get action type based on URL and method
  const getActionType = (url: string, _options: RequestInit): 'payment' | 'review' | 'other' => {
    if (url.includes('/payment')) return 'payment';
    if (url.includes('/review')) return 'review';
    return 'other';
  };

  // Specific methods for common operations
  const postPayment = async (meterId: string, amount: number, userId: string) => {
    return apiCall('/api/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meter_id: meterId,
        amount,
        userId,
      }),
    }, {
      enableQueue: true,
      retryAttempts: 3,
    });
  };

  const getPaymentStatus = async (meterId: string) => {
    return apiCall(`/api/payment/${meterId}`, {
      method: 'GET',
    }, {
      enableQueue: false,
      retryAttempts: 2,
      fallbackData: { totalPaid: 0, network: 'testnet' },
    });
  };

  const getRateLimitStatus = async (userId: string) => {
    return apiCall(`/api/rate-limit/${userId}`, {
      method: 'GET',
    }, {
      enableQueue: false,
      retryAttempts: 1,
      fallbackData: { remainingRequests: 5, resetTime: Date.now() + 60000 },
    });
  };

  const submitReview = async (rating: number, comment: string, transactionHash: string) => {
    return apiCall('/api/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rating,
        comment,
        transaction_hash: transactionHash,
      }),
    }, {
      enableQueue: true,
      retryAttempts: 2,
    });
  };

  return {
    apiCall,
    postPayment,
    getPaymentStatus,
    getRateLimitStatus,
    submitReview,
    checkConnectivity,
  };
}

// Utility function to handle offline errors in components
export function handleOfflineError(error: Error): {
  isOffline: boolean;
  message: string;
  queuedActionId?: string;
} {
  if (error instanceof OfflineApiError) {
    return {
      isOffline: error.isOffline,
      message: error.message,
      queuedActionId: error.queuedActionId,
    };
  }

  return {
    isOffline: false,
    message: error.message,
  };
}

// Utility for checking if we should show offline UI
export function shouldShowOfflineUI(error: any): boolean {
  return error instanceof OfflineApiError && error.isOffline;
}

// Utility for getting offline-friendly error messages
export function getOfflineErrorMessage(error: Error, context?: string): string {
  if (error instanceof OfflineApiError) {
    if (error.queuedActionId) {
      return `You're offline. Your ${context || 'action'} has been saved and will be completed automatically when you're back online.`;
    }
    return `You're offline. Please check your internet connection and try again.`;
  }

  // Network errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Timeout errors
  if (error.message.includes('timeout')) {
    return 'Request timed out. Please check your connection and try again.';
  }

  // Default error
  return error.message || 'An unexpected error occurred. Please try again.';
}
