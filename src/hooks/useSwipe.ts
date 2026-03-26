import { useRef, useCallback } from 'react';

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeOptions extends SwipeHandlers {
  /** Minimum px distance to register as a swipe (default 50) */
  threshold?: number;
  /** Max ms for the gesture to count (default 400) */
  timeout?: number;
}

interface TouchPoint {
  x: number;
  y: number;
  t: number;
}

export function useSwipe(options: SwipeOptions = {}) {
  const { threshold = 50, timeout = 400, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown } = options;
  const start = useRef<TouchPoint | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    const dt = Date.now() - start.current.t;
    start.current = null;

    if (dt > timeout) return;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy && absDx >= threshold) {
      dx > 0 ? onSwipeRight?.() : onSwipeLeft?.();
    } else if (absDy > absDx && absDy >= threshold) {
      dy > 0 ? onSwipeDown?.() : onSwipeUp?.();
    }
  }, [threshold, timeout, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return { onTouchStart, onTouchEnd };
}
