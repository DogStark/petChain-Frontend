import { useCallback, useEffect, useRef, useState } from 'react';

interface RateLimitState {
  isRateLimited: boolean;
  retryAfterSeconds: number;
}

interface UseRateLimitOptions {
  onRetry?: () => void;
}

interface UseRateLimitResult extends RateLimitState {
  startCountdown: (retryAfterSeconds: number) => void;
  reset: () => void;
}

const DEFAULT_RETRY_AFTER_SECONDS = 5;

/**
 * Detects HTTP 429 rate limit errors and exposes a countdown that auto-retries
 * the provided callback once the countdown reaches zero.
 */
export function useRateLimit({ onRetry }: UseRateLimitOptions = {}): UseRateLimitResult {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const onRetryRef = useRef(onRetry);

  useEffect(() => {
    onRetryRef.current = onRetry;
  }, [onRetry]);

  useEffect(() => {
    if (!isRateLimited || retryAfterSeconds <= 0) return;

    const timer = setTimeout(() => {
      setRetryAfterSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isRateLimited, retryAfterSeconds]);

  useEffect(() => {
    if (isRateLimited && retryAfterSeconds === 0) {
      setIsRateLimited(false);
      onRetryRef.current?.();
    }
  }, [isRateLimited, retryAfterSeconds]);

  const startCountdown = useCallback((seconds: number) => {
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : DEFAULT_RETRY_AFTER_SECONDS;
    setIsRateLimited(true);
    setRetryAfterSeconds(safeSeconds);
  }, []);

  const reset = useCallback(() => {
    setIsRateLimited(false);
    setRetryAfterSeconds(0);
  }, []);

  return { isRateLimited, retryAfterSeconds, startCountdown, reset };
}

/**
 * Returns the retry-after delay (in seconds) when the given error is a 429
 * rate limit response, otherwise null.
 */
export function getRateLimitRetryAfter(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;

  const candidate = error as {
    status?: number;
    response?: { status?: number; headers?: Record<string, string> };
  };

  const status = candidate.status ?? candidate.response?.status;
  if (status !== 429) return null;

  const headerValue = candidate.response?.headers?.['retry-after'];
  const parsed = headerValue ? Number.parseInt(headerValue, 10) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETRY_AFTER_SECONDS;
}
