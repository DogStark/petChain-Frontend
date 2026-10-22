import { useCallback, useState } from 'react';

export type SeriesExceptionAction = 'reschedule' | 'cancel';

export interface SeriesExceptionRequest {
  seriesId: string;
  occurrenceId: string;
  action: SeriesExceptionAction;
  /** New start time (ISO 8601). Required when action is 'reschedule'. */
  newStartAt?: string;
  /** Optional reason supplied by the user; backend owns consent/authorization. */
  reason?: string;
}

export interface SeriesExceptionResult {
  occurrenceId: string;
  action: SeriesExceptionAction;
  status: 'applied' | 'denied' | 'failed';
  message?: string;
}

export interface UseAppointmentSeriesOptions {
  /**
   * Transport for the exception request. The backend is the sole owner of
   * authorization and consent decisions; this hook only relays the outcome.
   */
  submitException: (request: SeriesExceptionRequest) => Promise<SeriesExceptionResult>;
}

export interface UseAppointmentSeriesState {
  pendingOccurrenceId: string | null;
  error: string | null;
  lastResult: SeriesExceptionResult | null;
  rescheduleOccurrence: (
    seriesId: string,
    occurrenceId: string,
    newStartAt: string,
    reason?: string,
  ) => Promise<SeriesExceptionResult>;
  cancelOccurrence: (
    seriesId: string,
    occurrenceId: string,
    reason?: string,
  ) => Promise<SeriesExceptionResult>;
  clearError: () => void;
}

/**
 * Manages editing a single occurrence of a recurring appointment series
 * without altering the rest of the series. Authorization and consent are
 * decided by the backend; this hook surfaces the result verbatim.
 */
export function useAppointmentSeries({
  submitException,
}: UseAppointmentSeriesOptions): UseAppointmentSeriesState {
  const [pendingOccurrenceId, setPendingOccurrenceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SeriesExceptionResult | null>(null);

  const run = useCallback(
    async (request: SeriesExceptionRequest): Promise<SeriesExceptionResult> => {
      setPendingOccurrenceId(request.occurrenceId);
      setError(null);
      try {
        const result = await submitException(request);
        setLastResult(result);
        if (result.status === 'denied') {
          setError(result.message ?? 'This change is not permitted for this occurrence.');
        } else if (result.status === 'failed') {
          setError(result.message ?? 'Unable to update this occurrence. Please try again.');
        }
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to update this occurrence. Please try again.';
        setError(message);
        const failed: SeriesExceptionResult = {
          occurrenceId: request.occurrenceId,
          action: request.action,
          status: 'failed',
          message,
        };
        setLastResult(failed);
        return failed;
      } finally {
        setPendingOccurrenceId(null);
      }
    },
    [submitException],
  );

  const rescheduleOccurrence = useCallback(
    (seriesId: string, occurrenceId: string, newStartAt: string, reason?: string) =>
      run({ seriesId, occurrenceId, action: 'reschedule', newStartAt, reason }),
    [run],
  );

  const cancelOccurrence = useCallback(
    (seriesId: string, occurrenceId: string, reason?: string) =>
      run({ seriesId, occurrenceId, action: 'cancel', reason }),
    [run],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    pendingOccurrenceId,
    error,
    lastResult,
    rescheduleOccurrence,
    cancelOccurrence,
    clearError,
  };
}
