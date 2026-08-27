import { useState, useCallback, useRef } from 'react';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface UseRateLimitReturn {
  isLimited: boolean;
  remainingRequests: number;
  resetTime: Date | null;
  checkLimit: () => boolean;
  reset: () => void;
}

export function useRateLimit(config: RateLimitConfig = { limit: 5, windowMs: 60_000 }): UseRateLimitReturn {
  const { limit, windowMs } = config;
  const timestamps = useRef<number[]>([]);
  const [isLimited, setIsLimited] = useState(false);
  const [remainingRequests, setRemainingRequests] = useState(limit);
  const [resetTime, setResetTime] = useState<Date | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getValidTimestamps = useCallback(() => {
    const now = Date.now();
    return timestamps.current.filter(t => now - t < windowMs);
  }, [windowMs]);

  const checkLimit = useCallback((): boolean => {
    const valid = getValidTimestamps();
    timestamps.current = valid;

    if (valid.length >= limit) {
      const oldest = Math.min(...valid);
      const reset = new Date(oldest + windowMs);
      setIsLimited(true);
      setRemainingRequests(0);
      setResetTime(reset);

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        timestamps.current = [];
        setIsLimited(false);
        setRemainingRequests(limit);
        setResetTime(null);
      }, oldest + windowMs - Date.now());

      return false;
    }

    timestamps.current = [...valid, Date.now()];
    const remaining = limit - timestamps.current.length;
    setIsLimited(false);
    setRemainingRequests(remaining);
    setResetTime(null);
    return true;
  }, [limit, windowMs, getValidTimestamps]);

  const reset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    timestamps.current = [];
    setIsLimited(false);
    setRemainingRequests(limit);
    setResetTime(null);
  }, [limit]);

  return { isLimited, remainingRequests, resetTime, checkLimit, reset };
}
