import React, { useCallback, useId, useMemo, useState } from 'react';

export type SeriesExceptionAction = 'reschedule' | 'cancel';

export interface SeriesOccurrence {
  id: string;
  startsAt: string;
  endsAt?: string;
  status?: 'scheduled' | 'cancelled' | 'completed';
}

export interface SeriesExceptionPayload {
  occurrenceId: string;
  action: SeriesExceptionAction;
  startsAt?: string;
  endsAt?: string;
  reason?: string;
}

export interface AppointmentSeriesEditorProps {
  /** Occurrences of the recurring series, as returned by the backend. */
  occurrences: SeriesOccurrence[];
  /**
   * Persists a single-occurrence exception. Authorization and consent
   * decisions are owned by the backend; this callback only forwards the
   * requested change and surfaces the backend result.
   */
  onSubmitException: (payload: SeriesExceptionPayload) => Promise<void>;
  /** Optional human-readable series label for the fieldset legend. */
  seriesLabel?: string;
}

function formatOccurrence(occurrence: SeriesOccurrence): string {
  const start = new Date(occurrence.startsAt);
  if (Number.isNaN(start.getTime())) {
    return occurrence.startsAt;
  }
  return start.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Lets a user reschedule or cancel a single occurrence of a recurring
 * appointment without affecting the rest of the series.
 */
export function AppointmentSeriesEditor({
  occurrences,
  onSubmitException,
  seriesLabel = 'Recurring appointment series',
}: AppointmentSeriesEditorProps) {
  const baseId = useId();
  const [selectedId, setSelectedId] = useState<string>('');
  const [action, setAction] = useState<SeriesExceptionAction>('reschedule');
  const [newStart, setNewStart] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const editableOccurrences = useMemo(
    () => occurrences.filter((occurrence) => occurrence.status !== 'cancelled'),
    [occurrences],
  );

  const selectedOccurrence = useMemo(
    () => editableOccurrences.find((occurrence) => occurrence.id === selectedId),
    [editableOccurrences, selectedId],
  );

  const handleSelect = useCallback(
    (occurrence: SeriesOccurrence) => {
      setSelectedId(occurrence.id);
      setNewStart(toLocalInputValue(occurrence.startsAt));
      setError(null);
      setSuccess(null);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setSuccess(null);

      if (!selectedOccurrence) {
        setError('Select an occurrence to edit.');
        return;
      }

      if (action === 'reschedule') {
        if (!newStart) {
          setError('Choose a new date and time for this occurrence.');
          return;
        }
        const parsed = new Date(newStart);
        if (Number.isNaN(parsed.getTime())) {
          setError('Enter a valid date and time.');
          return;
        }
      }

      const payload: SeriesExceptionPayload = {
        occurrenceId: selectedOccurrence.id,
        action,
        ...(action === 'reschedule'
          ? { startsAt: new Date(newStart).toISOString() }
          : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      };

      setSubmitting(true);
      try {
        await onSubmitException(payload);
        setSuccess(
          action === 'reschedule'
            ? 'This occurrence was rescheduled. The rest of the series is unchanged.'
            : 'This occurrence was cancelled. The rest of the series is unchanged.',
        );
      } catch (submitError) {
        setError(
          submitError instanceof Error && submitError.message
            ? submitError.message
            : 'The change could not be saved. Please try again.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [action, newStart, onSubmitException, reason, selectedOccurrence],
  );

  if (editableOccurrences.length === 0) {
    return (
      <section aria-labelledby={`${baseId}-heading`}>
        <h2 id={`${baseId}-heading`}>{seriesLabel}</h2>
        <p role="status">
          There are no upcoming occurrences to edit in this series.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${baseId}-heading`}>
      <h2 id={`${baseId}-heading`}>{seriesLabel}</h2>
      <p>
        Editing here changes only the selected occurrence. The rest of the
        series stays as scheduled.
      </p>

      <fieldset>
        <legend>Choose an occurrence</legend>
        <ul role="list">
          {editableOccurrences.map((occurrence) => {
            const inputId = `${baseId}-occurrence-${occurrence.id}`;
            return (
              <li key={occurrence.id}>
                <input
                  type="radio"
                  id={inputId}
                  name={`${baseId}-occurrence`}
                  value={occurrence.id}
                  checked={selectedId === occurrence.id}
                  onChange={() => handleSelect(occurrence)}
                />
                <label htmlFor={inputId}>
                  {formatOccurrence(occurrence)}
                  {occurrence.status === 'completed' ? ' (completed)' : ''}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <form onSubmit={handleSubmit} aria-describedby={`${baseId}-hint`}>
        <p id={`${baseId}-hint`}>
          Select an occurrence above, then choose to reschedule or cancel it.
        </p>

        <fieldset>
          <legend>Action for this occurrence</legend>
          <div>
            <input
              type="radio"
              id={`${baseId}-action-reschedule`}
              name={`${baseId}-action`}
              value="reschedule"
              checked={action === 'reschedule'}
              onChange={() => setAction('reschedule')}
            />
            <label htmlFor={`${baseId}-action-reschedule`}>Reschedule</label>
          </div>
          <div>
            <input
              type="radio"
              id={`${baseId}-action-cancel`}
              name={`${baseId}-action`}
              value="cancel"
              checked={action === 'cancel'}
              onChange={() => setAction('cancel')}
            />
            <label htmlFor={`${baseId}-action-cancel`}>Cancel</label>
          </div>
        </fieldset>

        {action === 'reschedule' ? (
          <div>
            <label htmlFor={`${baseId}-new-start`}>New date and time</label>
            <input
              id={`${baseId}-new-start`}
              type="datetime-local"
              value={newStart}
              onChange={(event) => setNewStart(event.target.value)}
              required
            />
          </div>
        ) : null}

        <div>
          <label htmlFor={`${baseId}-reason`}>Reason (optional)</label>
          <textarea
            id={`${baseId}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
          />
        </div>

        {error ? (
          <p role="alert" id={`${baseId}-error`}>
            {error}
          </p>
        ) : null}
        {success ? (
          <p role="status" id={`${baseId}-success`}>
            {success}
          </p>
        ) : null}

        <button type="submit" disabled={submitting || !selectedOccurrence}>
          {submitting ? 'Saving…' : 'Save this occurrence'}
        </button>
      </form>
    </section>
  );
}

export default AppointmentSeriesEditor;
