import { useState, useCallback, useEffect } from 'react';

export interface RateLimitStatus {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
  queued?: boolean;
  queuePosition?: number;
}

export interface UseRateLimitReturn {
  status: RateLimitStatus | null;
  isLoading: boolean;
  error: string | null;
  checkRateLimit: (userId: string) => Promise<void>;
  resetStatus: () => void;
  canMakeRequest: boolean;
  timeUntilReset: number;
  queueLength: number;
}

// In-memory rate limiting for frontend (fallback/backend sync would be better)
class FrontendRateLimiter {
  private userRequests: Map<string, number[]> = new Map();
  private readonly windowMs = 60 * 1000; // 1 minute
  private readonly maxRequests = 5;

  checkLimit(userId: string): RateLimitStatus {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Clean old requests
    const userRequestTimes = this.userRequests.get(userId) || [];
    const validRequests = userRequestTimes.filter(time => time >= windowStart);
    this.userRequests.set(userId, validRequests);
    
    const currentCount = validRequests.length;
    const oldestRequest = validRequests.length > 0 ? Math.min(...validRequests) : now;
    
    return {
      allowed: currentCount < this.maxRequests,
      remainingRequests: Math.max(0, this.maxRequests - currentCount),
      resetTime: new Date(oldestRequest + this.windowMs),
      queued: false
    };
  }

  recordRequest(userId: string): void {
    const now = Date.now();
    const userRequestTimes = this.userRequests.get(userId) || [];
    userRequestTimes.push(now);
    this.userRequests.set(userId, userRequestTimes);
  }

  resetUser(userId: string): void {
    this.userRequests.delete(userId);
  }
}

const frontendRateLimiter = new FrontendRateLimiter();

export function useRateLimit(): UseRateLimitReturn {
  const [status, setStatus] = useState<RateLimitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeUntilReset, setTimeUntilReset] = useState(0);

  const checkRateLimit = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API call to check rate limit
      // In production, this would call your backend API
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const rateLimitStatus = frontendRateLimiter.checkLimit(userId);
      setStatus(rateLimitStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check rate limit');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetStatus = useCallback(() => {
    setStatus(null);
    setError(null);
    setTimeUntilReset(0);
  }, []);

  // Update time until reset every second
  useEffect(() => {
    if (!status?.resetTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const resetTime = status.resetTime.getTime();
      const remaining = Math.max(0, resetTime - now);
      setTimeUntilReset(remaining);

      if (remaining === 0) {
        // Reset completed, check status again
        if (status.allowed === false) {
          checkRateLimit('current_user'); // Would use actual user ID
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status?.resetTime, status?.allowed, checkRateLimit]);

  const canMakeRequest = status?.allowed ?? true;
  const queueLength = status?.queuePosition ? status.queuePosition : 0;

  return {
    status,
    isLoading,
    error,
    checkRateLimit,
    resetStatus,
    canMakeRequest,
    timeUntilReset,
    queueLength
  };
}

export function usePaymentWithRateLimit() {
  const rateLimit = useRateLimit();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const processPayment = useCallback(async (
    paymentFunction: () => Promise<any>,
    userId: string
  ) => {
    // Check rate limit first
    await rateLimit.checkRateLimit(userId);
    
    if (!rateLimit.canMakeRequest) {
      setPaymentError(`Rate limit exceeded. Please wait ${Math.ceil(rateLimit.timeUntilReset / 1000)} seconds.`);
      return { success: false, error: 'Rate limit exceeded' };
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      // Record the request
      frontendRateLimiter.recordRequest(userId);
      
      // Execute the payment
      const result = await paymentFunction();
      
      // Update rate limit status
      await rateLimit.checkRateLimit(userId);
      
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      setPaymentError(errorMessage);
      
      // If payment failed, don't count it against rate limit
      frontendRateLimiter.resetUser(userId);
      await rateLimit.checkRateLimit(userId);
      
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  }, [rateLimit]);

  return {
    ...rateLimit,
    isProcessing,
    paymentError,
    processPayment,
    clearPaymentError: () => setPaymentError(null)
  };
}
