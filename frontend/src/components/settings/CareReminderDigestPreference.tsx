import React, { useCallback, useId, useState } from 'react';

export type ReminderType = 'medication' | 'vaccination' | 'appointment' | 'grooming';

export interface DigestWindow {
  startHour: number;
  endHour: number;
}

export interface CareReminderDigestPreferenceValue {
  enabled: boolean;
  window: DigestWindow;
  includedTypes: ReminderType[];
}

export interface CareReminderDigestPreferenceProps {
  initialValue?: CareReminderDigestPreferenceValue;
  onSave?: (value: CareReminderDigestPreferenceValue) => Promise<void> | void;
  disabled?: boolean;
}

const REMINDER_TYPE_OPTIONS: { value: ReminderType; label: string }[] = [
  { value: 'medication', label: 'Medication' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'grooming', label: 'Grooming' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

const DEFAULT_VALUE: CareReminderDigestPreferenceValue = {
  enabled: false,
  window: { startHour: 8, endHour: 20 },
  includedTypes: [],
};

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

export function CareReminderDigestPreference({
  initialValue = DEFAULT_VALUE,
  onSave,
  disabled = false,
}: CareReminderDigestPreferenceProps): JSX.Element {
  const [enabled, setEnabled] = useState(initialValue.enabled);
  const [startHour, setStartHour] = useState(initialValue.window.startHour);
  const [endHour, setEndHour] = useState(initialValue.window.endHour);
  const [includedTypes, setIncludedTypes] = useState<ReminderType[]>(
    initialValue.includedTypes,
  );
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );

  const baseId = useId();
  const enabledId = `${baseId}-enabled`;
  const startId = `${baseId}-start`;
  const endId = `${baseId}-end`;
  const typesGroupId = `${baseId}-types`;
  const statusId = `${baseId}-status`;

  const toggleType = useCallback((type: ReminderType) => {
    setIncludedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!onSave) {
        return;
      }
      setStatus('saving');
      try {
        await onSave({
          enabled,
          window: { startHour, endHour },
          includedTypes,
        });
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    },
    [enabled, endHour, includedTypes, onSave, startHour],
  );

  const windowInvalid = startHour >= endHour;

  return (
    <form
      className="care-reminder-digest-preference"
      onSubmit={handleSubmit}
      aria-describedby={statusId}
    >
      <fieldset disabled={disabled}>
        <legend>Daily care reminder digest</legend>

        <div className="care-reminder-digest-preference__toggle">
          <input
            id={enabledId}
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <label htmlFor={enabledId}>
            Send me a daily summary of care reminders
          </label>
        </div>

        <div className="care-reminder-digest-preference__window">
          <div>
            <label htmlFor={startId}>Summary window starts</label>
            <select
              id={startId}
              value={startHour}
              onChange={(event) => setStartHour(Number(event.target.value))}
              aria-invalid={windowInvalid}
            >
              {HOUR_OPTIONS.map((hour) => (
                <option key={hour} value={hour}>
                  {formatHour(hour)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={endId}>Summary window ends</label>
            <select
              id={endId}
              value={endHour}
              onChange={(event) => setEndHour(Number(event.target.value))}
              aria-invalid={windowInvalid}
            >
              {HOUR_OPTIONS.map((hour) => (
                <option key={hour} value={hour}>
                  {formatHour(hour)}
                </option>
              ))}
            </select>
          </div>
          {windowInvalid ? (
            <p role="alert" className="care-reminder-digest-preference__error">
              The summary window must end after it starts.
            </p>
          ) : null}
        </div>

        <fieldset
          id={typesGroupId}
          className="care-reminder-digest-preference__types"
        >
          <legend>Include these reminder types</legend>
          {REMINDER_TYPE_OPTIONS.map((option) => {
            const optionId = `${typesGroupId}-${option.value}`;
            return (
              <div key={option.value}>
                <input
                  id={optionId}
                  type="checkbox"
                  checked={includedTypes.includes(option.value)}
                  onChange={() => toggleType(option.value)}
                />
                <label htmlFor={optionId}>{option.label}</label>
              </div>
            );
          })}
        </fieldset>

        <p className="care-reminder-digest-preference__hint">
          Reminders already sent individually are not repeated in your digest.
        </p>

        <button type="submit" disabled={disabled || windowInvalid || status === 'saving'}>
          {status === 'saving' ? 'Saving…' : 'Save digest preference'}
        </button>

        <p id={statusId} role="status" aria-live="polite">
          {status === 'saved' ? 'Digest preference saved.' : null}
          {status === 'error'
            ? 'We could not save your digest preference. Please try again.'
            : null}
        </p>
      </fieldset>
    </form>
  );
}

export default CareReminderDigestPreference;
