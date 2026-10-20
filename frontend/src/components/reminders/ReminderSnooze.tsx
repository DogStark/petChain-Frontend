import { useCallback, useId, useMemo, useState } from 'react';

export interface ReminderSnoozeOption {
  /** Stable identifier used to dedupe snooze jobs. */
  id: string;
  /** Minutes from now until the reminder should return. */
  minutes: number;
  /** Human label for the bounded interval. */
  label: string;
}

/** Bounded, fixed set of snooze intervals. */
export const REMINDER_SNOOZE_OPTIONS: readonly ReminderSnoozeOption[] = [
  { id: '15m', minutes: 15, label: '15 minutes' },
  { id: '1h', minutes: 60, label: '1 hour' },
  { id: '4h', minutes: 240, label: '4 hours' },
  { id: '1d', minutes: 1440, label: '1 day' },
];

export interface ReminderSnoozeProps {
  /** Identifier of the reminder being snoozed. */
  reminderId: string;
  /** Called with the chosen return time and the option id. */
  onSnooze: (returnAt: Date, optionId: string) => void | Promise<void>;
  /** Optional locale override; defaults to the user's locale. */
  locale?: string;
  /** Optional clock injection for tests. */
  now?: () => Date;
  /** Disable interaction while a snooze is in flight. */
  disabled?: boolean;
}

function formatReturnTime(date: Date, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function ReminderSnooze({
  reminderId,
  onSnooze,
  locale,
  now = () => new Date(),
  disabled = false,
}: ReminderSnoozeProps) {
  const groupId = useId();
  const [selectedId, setSelectedId] = useState<string>(REMINDER_SNOOZE_OPTIONS[0].id);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => REMINDER_SNOOZE_OPTIONS.find((option) => option.id === selectedId) ?? REMINDER_SNOOZE_OPTIONS[0],
    [selectedId],
  );

  const returnAt = useMemo(
    () => new Date(now().getTime() + selected.minutes * 60_000),
    [now, selected],
  );

  const returnLabel = formatReturnTime(returnAt, locale);
  const isBusy = pending || disabled;

  const handleSnooze = useCallback(async () => {
    if (isBusy) return;
    setPending(true);
    setError(null);
    try {
      // Reuse the same reminderId so repeated snoozes update the existing job
      // instead of creating duplicates.
      await onSnooze(returnAt, selected.id);
    } catch {
      setError('Could not snooze this reminder. Please try again.');
    } finally {
      setPending(false);
    }
  }, [isBusy, onSnooze, returnAt, selected.id]);

  return (
    <div className="reminder-snooze" role="group" aria-labelledby={`${groupId}-title`}>
      <p id={`${groupId}-title`} className="reminder-snooze__title">
        Snooze reminder
      </p>

      <fieldset className="reminder-snooze__options" disabled={isBusy}>
        <legend className="reminder-snooze__legend">Choose when to be reminded</legend>
        {REMINDER_SNOOZE_OPTIONS.map((option) => {
          const optionId = `${groupId}-${option.id}`;
          return (
            <div key={option.id} className="reminder-snooze__option">
              <input
                id={optionId}
                type="radio"
                name={`${groupId}-interval`}
                value={option.id}
                checked={selectedId === option.id}
                onChange={() => setSelectedId(option.id)}
              />
              <label htmlFor={optionId}>{option.label}</label>
            </div>
          );
        })}
      </fieldset>

      <p className="reminder-snooze__return" aria-live="polite">
        Reminder will return on <time dateTime={returnAt.toISOString()}>{returnLabel}</time>
      </p>

      {error ? (
        <p className="reminder-snooze__error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className="reminder-snooze__submit"
        onClick={handleSnooze}
        disabled={isBusy}
        aria-busy={pending}
        aria-describedby={`${groupId}-title`}
        data-reminder-id={reminderId}
      >
        {pending ? 'Snoozing…' : `Snooze until ${returnLabel}`}
      </button>
    </div>
  );
}

export default ReminderSnooze;
