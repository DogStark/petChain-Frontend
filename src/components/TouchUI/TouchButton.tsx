import { useRef, useState } from 'react';
import { useHaptic, HapticStyle } from '@/hooks/useHaptic';

interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  haptic?: HapticStyle | false;
  fullWidth?: boolean;
}

const VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm',
  secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  ghost: 'bg-transparent text-blue-600 hover:bg-blue-50 active:bg-blue-100',
};

// min 44px tap target per WCAG 2.5.5
const SIZES = {
  sm: 'min-h-[44px] px-4 text-sm',
  md: 'min-h-[44px] px-5 text-base',
  lg: 'min-h-[52px] px-6 text-base font-semibold',
};

export default function TouchButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  haptic = 'light',
  fullWidth = false,
  disabled,
  onClick,
  children,
  className = '',
  ...rest
}: TouchButtonProps) {
  const { trigger } = useHaptic();
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);
  const rippleId = useRef(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    const rect = btnRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = ++rippleId.current;
    setRipples((r) => [...r, { id, x, y }]);
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 600);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (haptic !== false) trigger(haptic);
    onClick?.(e);
  };

  return (
    <button
      ref={btnRef}
      disabled={disabled || loading}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      aria-busy={loading}
      className={`
        relative overflow-hidden inline-flex items-center justify-center gap-2
        rounded-xl font-medium transition-all duration-150 select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        touch-manipulation
        ${VARIANTS[variant]} ${SIZES[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...rest}
    >
      {/* Ripple effect */}
      {ripples.map((rp) => (
        <span
          key={rp.id}
          aria-hidden="true"
          className="absolute rounded-full bg-white/30 animate-ripple pointer-events-none"
          style={{ left: rp.x - 20, top: rp.y - 20, width: 40, height: 40 }}
        />
      ))}

      {loading && (
        <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
