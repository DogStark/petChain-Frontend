import { useCallback, useEffect, useRef, useState } from 'react';

export type CareReminderType =
  | 'medication'
  | 'vaccination'
  | 'grooming'
  | 'feeding'
  | 'vet_visit';

export interface CareReminderDigestPreference {
  enabled: boolean;
  /** Local time-of-day (HH:mm) at which the daily digest is delivered. */
  windowStart: string;
  /** Local time-of-day (HH:mm) at which the digest window closes. */
  windowEnd: string;
  /** Reminder types included in the digest. */
  includedTypes: CareReminderType[];
}

export const CARE_REMINDER_TYPES: CareReminderType[] = [
  'medication',
  'vaccination',
  'grooming',
  'feeding',
  'vet_visit',
];

export const DEFAULT_DIGEST_PREFERENCE: CareReminderDigestPreference = {
  enabled: false,
  windowStart: '08:00',
  windowEnd: '20:00',
  includedTypes: [],
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeWindow(start: string, end: string): boolean {
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
    return false;
  }
  return start < end;
}

export interface UseCareReminderDigestPreferenceOptions {
  /** Loads the current preference from the backend. */
  load?: () => Promise<CareReminderDigestPreference>;
  /** Persists the preference; backend owns authorization/consent decisions. */
  save?: (preference: CareReminderDigestPreference) => Promise<void>;
}

export interface UseCareReminderDigestPreferenceResult {
  preference: CareReminderDigestPreference;
  loading: boolean;
  saving: boolean;
  /** True when the backend denied access or consent was not granted. */
  denied: boolean;
  error: string | null;
  /** True when the current window/types are valid and can be submitted. */
  canSubmit: boolean;
  setEnabled: (enabled: boolean) => void;
  setWindowStart: (value: string) => void;
  setWindowEnd: (value: string) => void;
  toggleType: (type: CareReminderType) => void;
  submit: () => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Manages the daily care reminder digest preference.
 *
 * The frontend only collects and submits the preference. Whether a reminder is
 * delivered individually or folded into the digest (and whether the user is
 * authorized/consented) is decided by the backend, so no duplicate-delivery
 * logic lives here.
 */
export function useCareReminderDigestPreference(
  options: UseCareReminderDigestPreferenceOptions = {},
): UseCareReminderDigestPreferenceResult {
  const { load, save } = options;
  const [preference, setPreference] = useState<CareReminderDigestPreference>(
    DEFAULT_DIGEST_PREFERENCE,
  );
  const [loading, setLoading] = useState<boolean>(Boolean(load));
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!load) {
      return;
    }
    setLoading(true);
    setError(null);
    setDenied(false);
    try {
      const next = await load();
      if (mountedRef.current) {
        setPreference(next);
      }
    } catch (err) {
      if (mountedRef.current) {
        if (isDeniedError(err)) {
          setDenied(true);
        } else {
          setError('Unable to load your digest preference.');
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setEnabled = useCallback((enabled: boolean) => {
    setPreference((prev) => ({ ...prev, enabled }));
  }, []);

  const setWindowStart = useCallback((value: string) => {
    setPreference((prev) => ({ ...prev, windowStart: value }));
  }, []);

  const setWindowEnd = useCallback((value: string) => {
    setPreference((prev) => ({ ...prev, windowEnd: value }));
  }, []);

  const toggleType = useCallback((type: CareReminderType) => {
    setPreference((prev) => {
      const has = prev.includedTypes.includes(type);
      return {
        ...prev,
        includedTypes: has
          ? prev.includedTypes.filter((t) => t !== type)
          : [...prev.includedTypes, type],
      };
    });
  }, []);

  const canSubmit =
    !saving &&
    (!preference.enabled ||
      (isValidTimeWindow(preference.windowStart, preference.windowEnd) &&
        preference.includedTypes.length > 0));

  const submit = useCallback(async () => {
    if (!save) {
      return;
    }
    if (
      preference.enabled &&
      (!isValidTimeWindow(preference.windowStart, preference.windowEnd) ||
        preference.includedTypes.length === 0)
    ) {
      setError('Choose a valid window and at least one reminder type.');
      return;
    }
    setSaving(true);
    setError(null);
    setDenied(false);
    try {
      await save(preference);
    } catch (err) {
      if (mountedRef.current) {
        if (isDeniedError(err)) {
          setDenied(true);
        } else {
          setError('Unable to save your digest preference.');
        }
      }
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [preference, save]);

  return {
    preference,
    loading,
    saving,
    denied,
    error,
    canSubmit,
    setEnabled,
    setWindowStart,
    setWindowEnd,
    toggleType,
    submit,
    reload,
  };
}

function isDeniedError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const status = (err as { status?: unknown }).status;
    if (status === 401 || status === 403) {
      return true;
    }
    const code = (err as { code?: unknown }).code;
    if (code === 'FORBIDDEN' || code === 'UNAUTHORIZED' || code === 'CONSENT_REQUIRED') {
      return true;
    }
  }
  return false;
}
