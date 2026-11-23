import { useEffect, useMemo, useRef, useState } from 'react';

export type EmergencyFieldKey = 'currentMedication' | 'temporaryContact';

export interface EmergencyFieldValue {
  value: string;
  /** ISO timestamp when the field should expire; null/undefined means permanent. */
  expiresAt?: string | null;
}

export interface EmergencyProfile {
  currentMedication?: EmergencyFieldValue;
  temporaryContact?: EmergencyFieldValue;
}

export interface EmergencyProfileFormProps {
  initialProfile?: EmergencyProfile;
  /** Backend owns authorization/consent; frontend only reflects the decision. */
  canEdit?: boolean;
  onSubmit?: (profile: EmergencyProfile) => void | Promise<void>;
  /** Injectable clock for tests. */
  now?: () => number;
}

const FIELD_LABELS: Record<EmergencyFieldKey, string> = {
  currentMedication: 'Current medication',
  temporaryContact: 'Temporary contact',
};

const EXPIRY_OPTIONS: { label: string; hours: number | null }[] = [
  { label: 'No expiry', hours: null },
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
];

const WARNING_WINDOW_MS = 60 * 60 * 1000; // warn within 1 hour of expiry

function toIsoFromHours(hours: number | null, nowMs: number): string | null {
  if (hours === null) return null;
  return new Date(nowMs + hours * 60 * 60 * 1000).toISOString();
}

function isExpired(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return false;
  return ts <= nowMs;
}

function isExpiringSoon(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return false;
  return ts > nowMs && ts - nowMs <= WARNING_WINDOW_MS;
}

function formatExpiry(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'No expiry';
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return 'No expiry';
  return new Date(ts).toLocaleString();
}

export default function EmergencyProfileForm({
  initialProfile,
  canEdit = true,
  onSubmit,
  now = Date.now,
}: EmergencyProfileFormProps) {
  const [profile, setProfile] = useState<EmergencyProfile>(initialProfile ?? {});
  const [nowMs, setNowMs] = useState<number>(() => now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warningRef = useRef<HTMLDivElement | null>(null);

  // Keep the clock fresh so expiry warnings appear without a reload.
  useEffect(() => {
    const id = setInterval(() => setNowMs(now()), 30_000);
    return () => clearInterval(id);
  }, [now]);

  const expiringSoon = useMemo(() => {
    return (Object.keys(FIELD_LABELS) as EmergencyFieldKey[]).filter((key) =>
      isExpiringSoon(profile[key]?.expiresAt, nowMs),
    );
  }, [profile, nowMs]);

  const updateField = (key: EmergencyFieldKey, patch: Partial<EmergencyFieldValue>) => {
    setProfile((prev) => {
      const current = prev[key] ?? { value: '' };
      return { ...prev, [key]: { ...current, ...patch } };
    });
  };

  const handleExpiryChange = (key: EmergencyFieldKey, raw: string) => {
    const hours = raw === '' ? null : Number(raw);
    updateField(key, { expiresAt: toIsoFromHours(hours, now()) });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit?.(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save emergency profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canEdit) {
    return (
      <section aria-labelledby="emergency-profile-heading">
        <h2 id="emergency-profile-heading">Emergency profile</h2>
        <p role="status">
          You do not have permission to edit the emergency profile. Contact the pet owner or
          administrator if this is unexpected.
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby="emergency-profile-heading" noValidate>
      <h2 id="emergency-profile-heading">Emergency profile</h2>

      {expiringSoon.length > 0 && (
        <div
          ref={warningRef}
          role="alert"
          aria-live="polite"
          tabIndex={-1}
          style={{ border: '1px solid #b45309', padding: '0.5rem', marginBottom: '1rem' }}
        >
          <strong>Heads up:</strong> the following temporary fields will be removed soon:{' '}
          {expiringSoon.map((key) => FIELD_LABELS[key]).join(', ')}. Update the expiry if you want
          to keep them.
        </div>
      )}

      {(Object.keys(FIELD_LABELS) as EmergencyFieldKey[]).map((key) => {
        const field = profile[key];
        const expired = isExpired(field?.expiresAt, nowMs);
        const inputId = `emergency-${key}`;
        const expiryId = `${inputId}-expiry`;
        const statusId = `${inputId}-status`;
        return (
          <fieldset key={key} style={{ marginBottom: '1rem' }}>
            <legend>{FIELD_LABELS[key]}</legend>
            <label htmlFor={inputId}>{FIELD_LABELS[key]} value</label>
            <input
              id={inputId}
              type="text"
              value={field?.value ?? ''}
              aria-describedby={statusId}
              onChange={(e) => updateField(key, { value: e.target.value })}
            />
            <label htmlFor={expiryId}>Expires</label>
            <select
              id={expiryId}
              value={field?.expiresAt ? String(hoursUntil(field.expiresAt, nowMs)) : ''}
              onChange={(e) => handleExpiryChange(key, e.target.value)}
            >
              {EXPIRY_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.hours === null ? '' : String(opt.hours)}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p id={statusId} role="status">
              {expired
                ? `${FIELD_LABELS[key]} has expired and will be removed on save.`
                : `Expiry: ${formatExpiry(field?.expiresAt)}`}
            </p>
          </fieldset>
        );
      })}

      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save emergency profile'}
      </button>
    </form>
  );
}

function hoursUntil(expiresAt: string, nowMs: number): number {
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.round((ts - nowMs) / (60 * 60 * 1000)));
}
