import { useCallback, useEffect, useId, useMemo, useState } from 'react';

export type TimezoneTravelPolicy = 'keep-local' | 'keep-absolute';

export interface QuietHoursConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
  travelPolicy: TimezoneTravelPolicy;
}

export interface QuietHoursSettingsProps {
  initialConfig?: Partial<QuietHoursConfig>;
  /** Backend-owned consent/authorization result. Frontend never decides this. */
  canEdit?: boolean;
  deniedReason?: string;
  onSave?: (config: QuietHoursConfig) => Promise<void> | void;
}

const DEFAULT_CONFIG: QuietHoursConfig = {
  enabled: false,
  startTime: '22:00',
  endTime: '07:00',
  timezone: 'UTC',
  travelPolicy: 'keep-local',
};

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function QuietHoursSettings({
  initialConfig,
  canEdit = true,
  deniedReason,
  onSave,
}: QuietHoursSettingsProps) {
  const baseId = useId();
  const [config, setConfig] = useState<QuietHoursConfig>({
    ...DEFAULT_CONFIG,
    timezone: detectTimezone(),
    ...initialConfig,
  });
  const [detectedTimezone, setDetectedTimezone] = useState<string>(() => detectTimezone());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Detect device timezone changes (e.g. travel) and surface a policy decision.
  useEffect(() => {
    const check = () => {
      const current = detectTimezone();
      setDetectedTimezone((prev) => {
        if (prev !== current) {
          setConfig((cfg) =>
            cfg.travelPolicy === 'keep-local'
              ? { ...cfg, timezone: current }
              : cfg,
          );
        }
        return current;
      });
    };
    const interval = window.setInterval(check, 60_000);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', check);
    };
  }, []);

  const timezoneChanged = useMemo(
    () => detectedTimezone !== config.timezone,
    [detectedTimezone, config.timezone],
  );

  const update = useCallback(<K extends keyof QuietHoursConfig>(key: K, value: QuietHoursConfig[K]) => {
    setSaved(false);
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!canEdit) return;
      if (!isValidTime(config.startTime) || !isValidTime(config.endTime)) {
        setError('Quiet hours must use valid 24-hour times (HH:MM).');
        return;
      }
      setError(null);
      setSaving(true);
      try {
        await onSave?.(config);
        setSaved(true);
      } catch {
        setError('Could not save quiet hours. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [canEdit, config, onSave],
  );

  if (!canEdit) {
    return (
      <section aria-labelledby={`${baseId}-title`} className="quiet-hours quiet-hours--denied">
        <h2 id={`${baseId}-title`}>Quiet hours</h2>
        <p role="status">
          {deniedReason ?? 'You do not have permission to change quiet hours.'}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${baseId}-title`} className="quiet-hours">
      <h2 id={`${baseId}-title`}>Quiet hours</h2>
      <p id={`${baseId}-desc`}>
        Pause reminders during your local quiet hours. Reminder delivery is
        scheduled by the backend using the timezone and travel policy below.
      </p>
      <form onSubmit={handleSubmit} aria-describedby={`${baseId}-desc`}>
        <div>
          <input
            id={`${baseId}-enabled`}
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
          />
          <label htmlFor={`${baseId}-enabled`}>Enable quiet hours</label>
        </div>

        <fieldset disabled={!config.enabled}>
          <legend>Quiet window (local time)</legend>
          <div>
            <label htmlFor={`${baseId}-start`}>Start</label>
            <input
              id={`${baseId}-start`}
              type="time"
              value={config.startTime}
              onChange={(e) => update('startTime', e.target.value)}
              aria-invalid={!isValidTime(config.startTime)}
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-end`}>End</label>
            <input
              id={`${baseId}-end`}
              type="time"
              value={config.endTime}
              onChange={(e) => update('endTime', e.target.value)}
              aria-invalid={!isValidTime(config.endTime)}
            />
          </div>
        </fieldset>

        <fieldset>
          <legend>When your timezone changes</legend>
          <div>
            <input
              id={`${baseId}-policy-local`}
              type="radio"
              name={`${baseId}-policy`}
              checked={config.travelPolicy === 'keep-local'}
              onChange={() => update('travelPolicy', 'keep-local')}
            />
            <label htmlFor={`${baseId}-policy-local`}>
              Keep quiet hours at my local time (follow me when I travel)
            </label>
          </div>
          <div>
            <input
              id={`${baseId}-policy-absolute`}
              type="radio"
              name={`${baseId}-policy`}
              checked={config.travelPolicy === 'keep-absolute'}
              onChange={() => update('travelPolicy', 'keep-absolute')}
            />
            <label htmlFor={`${baseId}-policy-absolute`}>
              Keep the original timezone ({config.timezone})
            </label>
          </div>
        </fieldset>

        <p>
          Current timezone: <strong>{config.timezone}</strong>
          {timezoneChanged && (
            <span role="status">
              {' '}— device timezone is now {detectedTimezone}.
            </span>
          )}
        </p>

        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">Quiet hours saved.</p>}

        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save quiet hours'}
        </button>
      </form>
    </section>
  );
}

export default QuietHoursSettings;
