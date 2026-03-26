import { useEffect, useRef, useState } from 'react';
import { ToastNotification } from '@/types/notification';

const ICONS = {
  success: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const STYLES = {
  success: { bar: 'bg-green-500', icon: 'text-green-600 bg-green-50', border: 'border-green-100' },
  error:   { bar: 'bg-red-500',   icon: 'text-red-600 bg-red-50',     border: 'border-red-100' },
  warning: { bar: 'bg-amber-500', icon: 'text-amber-600 bg-amber-50', border: 'border-amber-100' },
  info:    { bar: 'bg-blue-500',  icon: 'text-blue-600 bg-blue-50',   border: 'border-blue-100' },
};

interface ToastProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<number>(0);
  const duration = toast.duration ?? 5000;
  const sticky = duration === 0;

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-dismiss with progress bar
  useEffect(() => {
    if (sticky) return;
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct > 0) {
        timerRef.current = setTimeout(tick, 50);
      } else {
        handleDismiss();
      }
    };
    timerRef.current = setTimeout(tick, 50);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const s = STYLES[toast.type];

  return (
    <div
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`
        relative w-full max-w-sm bg-white rounded-2xl shadow-lg border ${s.border}
        overflow-hidden transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      {/* Progress bar */}
      {!sticky && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-100">
          <div
            className={`h-full ${s.bar} transition-none`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex items-start gap-3 p-4 pt-5">
        {/* Icon */}
        <span className={`shrink-0 p-1.5 rounded-lg ${s.icon}`}>
          {ICONS[toast.type]}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{toast.message}</p>
          )}
          {toast.actionLabel && toast.onAction && (
            <button
              onClick={() => { toast.onAction!(); handleDismiss(); }}
              className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {toast.actionLabel} →
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
