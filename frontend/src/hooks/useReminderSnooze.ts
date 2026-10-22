import { useCallback, useMemo, useState } from 'react';
import { snoozeReminder } from '../lib/api/notifications';

/**
 * Bounded snooze intervals offered to the user. Keeping this list fixed
 * prevents unbounded/duplicate scheduling and keeps the UI predictable.
 */
export const SNOOZE_OPTIONS = [
  { minutes: 10, label: '10 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 24 * 60, label: '1 day' },
] as const;

export type SnoozeMinutes = (typeof SNOOZE_OPTIONS)[number]['minutes'];

export interface SnoozeState {
  /** Reminder id currently being snoozed, or null when idle. */
  reminderId: string | null;
  /** Selected interval in minutes. */
  minutes: SnoozeMinutes;
  /** ISO timestamp of the chosen return time, or null before selection. */
  returnAt: string | null;
  /** True while a snooze request is in flight. */
  isSubmitting: boolean;
  /** Error message from the last failed attempt, if any. */
  error: string | null;
}

const DEFAULT_MINUTES: SnoozeMinutes = SNOOZE_OPTIONS[0].minutes;

/**
 * Compute the return time for a snooze. Exposed for tests and for rendering
 * the chosen return time in the user's locale.
 */
export function computeReturnAt(minutes: number, from: Date = new Date()): string {
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

/**
 * Format an ISO timestamp in the user's locale for display next to the
 * snooze controls.
 */
export function formatReturnAt(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export interface UseReminderSnoozeResult {
  options: typeof SNOOZE_OPTIONS;
  state: SnoozeState;
  /** Preview of the return time for the currently selected interval. */
  previewReturnAt: string;
  /** Human-readable, locale-formatted preview of the return time. */
  previewLabel: string;
  selectMinutes: (minutes: SnoozeMinutes) => void;
  /**
   * Snooze the given reminder. Repeated calls for the same reminder reuse the
   * existing job on the backend (idempotent update) rather than creating a
   * duplicate; the hook also guards against concurrent submissions.
   */
  snooze: (reminderId: string, minutes?: SnoozeMinutes) => Promise<boolean>;
  reset: () => void;
}

export function useReminderSnooze(locale?: string): UseReminderSnoozeResult {
  const [state, setState] = useState<SnoozeState>({
    reminderId: null,
    minutes: DEFAULT_MINUTES,
    returnAt: null,
    isSubmitting: false,
    error: null,
  });

  const selectMinutes = useCallback((minutes: SnoozeMinutes) => {
    setState((prev) => ({ ...prev, minutes, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      reminderId: null,
      minutes: DEFAULT_MINUTES,
      returnAt: null,
      isSubmitting: false,
      error: null,
    });
  }, []);

  const snooze = useCallback(
    async (reminderId: string, minutes?: SnoozeMinutes): Promise<boolean> => {
      let shouldProceed = false;
      setState((prev) => {
        if (prev.isSubmitting) return prev;
        shouldProceed = true;
        return {
          ...prev,
          reminderId,
          minutes: minutes ?? prev.minutes,
          isSubmitting: true,
          error: null,
        };
      });
      if (!shouldProceed) return false;

      const chosenMinutes = minutes ?? state.minutes;
      const returnAt = computeReturnAt(chosenMinutes);

      try {
        await snoozeReminder(reminderId, { minutes: chosenMinutes, returnAt });
        setState((prev) => ({
          ...prev,
          reminderId,
          minutes: chosenMinutes,
          returnAt,
          isSubmitting: false,
          error: null,
        }));
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to snooze reminder.';
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: message,
        }));
        return false;
      }
    },
    [state.minutes],
  );

  const previewReturnAt = useMemo(
    () => computeReturnAt(state.minutes),
    [state.minutes],
  );

  const previewLabel = useMemo(
    () => formatReturnAt(previewReturnAt, locale),
    [previewReturnAt, locale],
  );

  return {
    options: SNOOZE_OPTIONS,
    state,
    previewReturnAt,
    previewLabel,
    selectMinutes,
    snooze,
    reset,
  };
}
