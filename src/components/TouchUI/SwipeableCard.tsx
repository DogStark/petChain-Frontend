import { useRef, useState } from 'react';
import { useHaptic } from '@/hooks/useHaptic';

interface SwipeAction {
  label: string;
  icon?: React.ReactNode;
  color: string; // bg color class e.g. 'bg-red-500'
  onAction: () => void;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  /** px threshold to trigger action (default 80) */
  threshold?: number;
  className?: string;
}

/**
 * SwipeableCard — reveals action buttons on left/right swipe.
 * Uses pointer events so it works with both touch and mouse.
 */
export default function SwipeableCard({
  children,
  leftAction,
  rightAction,
  threshold = 80,
  className = '',
}: SwipeableCardProps) {
  const { trigger } = useHaptic();
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const triggered = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    triggered.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    // Only allow swipe in direction that has an action
    if (dx > 0 && !leftAction) return;
    if (dx < 0 && !rightAction) return;
    const clamped = Math.max(rightAction ? -threshold * 1.2 : 0, Math.min(leftAction ? threshold * 1.2 : 0, dx));
    setOffset(clamped);

    // Haptic at threshold
    if (!triggered.current && Math.abs(clamped) >= threshold) {
      trigger('medium');
      triggered.current = true;
    }
  };

  const onPointerUp = () => {
    if (Math.abs(offset) >= threshold) {
      if (offset > 0) leftAction?.onAction();
      else rightAction?.onAction();
    }
    setOffset(0);
    startX.current = null;
    triggered.current = false;
  };

  const revealLeft = offset > 0 && leftAction;
  const revealRight = offset < 0 && rightAction;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {/* Left action reveal */}
      {leftAction && (
        <div
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 flex items-center justify-start px-5 ${leftAction.color} transition-opacity ${revealLeft ? 'opacity-100' : 'opacity-0'}`}
          style={{ width: threshold }}
        >
          <div className="flex flex-col items-center gap-1 text-white text-xs font-semibold">
            {leftAction.icon}
            <span>{leftAction.label}</span>
          </div>
        </div>
      )}

      {/* Right action reveal */}
      {rightAction && (
        <div
          aria-hidden="true"
          className={`absolute inset-y-0 right-0 flex items-center justify-end px-5 ${rightAction.color} transition-opacity ${revealRight ? 'opacity-100' : 'opacity-0'}`}
          style={{ width: threshold }}
        >
          <div className="flex flex-col items-center gap-1 text-white text-xs font-semibold">
            {rightAction.icon}
            <span>{rightAction.label}</span>
          </div>
        </div>
      )}

      {/* Card content */}
      <div
        role="listitem"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.25s ease' : 'none' }}
        className="relative bg-white touch-pan-y select-none cursor-grab active:cursor-grabbing"
      >
        {children}
      </div>
    </div>
  );
}
