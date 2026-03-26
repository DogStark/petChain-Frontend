/**
 * useHaptic — wraps the Vibration API for haptic feedback.
 * Falls back silently on unsupported devices.
 */
export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERNS: Record<HapticStyle, number | number[]> = {
  light:   10,
  medium:  20,
  heavy:   40,
  success: [10, 50, 10],
  warning: [20, 40, 20],
  error:   [40, 30, 40, 30, 40],
};

export function useHaptic() {
  const trigger = (style: HapticStyle = 'light') => {
    if (typeof window === 'undefined') return;
    if (!('vibrate' in navigator)) return;
    try {
      navigator.vibrate(PATTERNS[style]);
    } catch {
      // silently ignore — some browsers block vibrate
    }
  };

  return { trigger };
}
