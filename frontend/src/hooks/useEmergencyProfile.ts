import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type EmergencyFieldKind = 'medication' | 'contact' | 'other';

export interface EmergencyProfileField {
  id: string;
  kind: EmergencyFieldKind;
  label: string;
  value: string;
  /** ISO timestamp when the field should expire. Null means permanent. */
  expiresAt: string | null;
}

export interface EmergencyProfile {
  petId: string;
  fields: EmergencyProfileField[];
}

export type EmergencyProfileStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

export interface ExpiringFieldWarning {
  field: EmergencyProfileField;
  /** Milliseconds until expiry (negative if already past). */
  msRemaining: number;
  expired: boolean;
}

/** Fields within this window are surfaced with a removal warning. */
export const EXPIRY_WARNING_WINDOW_MS = 24 * 60 * 60 * 1000;

const TEMPORARY_KINDS: ReadonlySet<EmergencyFieldKind> = new Set(['medication', 'contact']);

export function isTemporaryField(field: EmergencyProfileField): boolean {
  return TEMPORARY_KINDS.has(field.kind) || field.expiresAt !== null;
}

export function computeExpiryWarnings(
  fields: EmergencyProfileField[],
  now: number = Date.now(),
  windowMs: number = EXPIRY_WARNING_WINDOW_MS,
): ExpiringFieldWarning[] {
  const warnings: ExpiringFieldWarning[] = [];
  for (const field of fields) {
    if (!field.expiresAt) continue;
    const expiry = Date.parse(field.expiresAt);
    if (Number.isNaN(expiry)) continue;
    const msRemaining = expiry - now;
    if (msRemaining <= windowMs) {
      warnings.push({ field, msRemaining, expired: msRemaining <= 0 });
    }
  }
  return warnings.sort((a, b) => a.msRemaining - b.msRemaining);
}

export interface UseEmergencyProfileOptions {
  /** Injected for tests; defaults to the app's API client. */
  fetcher?: (petId: string, signal: AbortSignal) => Promise<EmergencyProfile>;
  /** Injected for tests; defaults to the app's API client. */
  updater?: (
    petId: string,
    fieldId: string,
    expiresAt: string | null,
    signal: AbortSignal,
  ) => Promise<EmergencyProfile>;
  now?: () => number;
}

export interface UseEmergencyProfileResult {
  status: EmergencyProfileStatus;
  profile: EmergencyProfile | null;
  warnings: ExpiringFieldWarning[];
  error: string | null;
  /** Field awaiting confirmation before its expiry is cleared (removal). */
  pendingRemoval: EmergencyProfileField | null;
  requestRemoval: (field: EmergencyProfileField) => void;
  cancelRemoval: () => void;
  confirmRemoval: () => Promise<void>;
  setFieldExpiry: (fieldId: string, expiresAt: string | null) => Promise<void>;
  reload: () => void;
}

async function defaultFetcher(petId: string, signal: AbortSignal): Promise<EmergencyProfile> {
  const res = await fetch(`/api/pets/${encodeURIComponent(petId)}/emergency-profile`, {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('denied');
    (err as Error & { denied?: boolean }).denied = true;
    throw err;
  }
  if (!res.ok) throw new Error(`Failed to load emergency profile (${res.status})`);
  return (await res.json()) as EmergencyProfile;
}

async function defaultUpdater(
  petId: string,
  fieldId: string,
  expiresAt: string | null,
  signal: AbortSignal,
): Promise<EmergencyProfile> {
  const res = await fetch(
    `/api/pets/${encodeURIComponent(petId)}/emergency-profile/fields/${encodeURIComponent(fieldId)}`,
    {
      method: 'PATCH',
      signal,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ expiresAt }),
    },
  );
  if (res.status === 401 || res.status === 403) {
    const err = new Error('denied');
    (err as Error & { denied?: boolean }).denied = true;
    throw err;
  }
  if (!res.ok) throw new Error(`Failed to update field expiry (${res.status})`);
  return (await res.json()) as EmergencyProfile;
}

/**
 * Loads an emergency profile and manages expiry controls for temporary fields.
 * Authorization and consent are decided by the backend; this hook only reflects
 * the server's response (including denied states) and never grants access.
 */
export function useEmergencyProfile(
  petId: string | null,
  options: UseEmergencyProfileOptions = {},
): UseEmergencyProfileResult {
  const { fetcher = defaultFetcher, updater = defaultUpdater, now = Date.now } = options;
  const [status, setStatus] = useState<EmergencyProfileStatus>('idle');
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<EmergencyProfileField | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!petId) {
      setStatus('idle');
      setProfile(null);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setError(null);
    fetcher(petId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setProfile(data);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const denied = Boolean((err as { denied?: boolean } | null)?.denied);
        setStatus(denied ? 'denied' : 'error');
        setError(denied ? null : err instanceof Error ? err.message : 'Unknown error');
      });
    return () => controller.abort();
  }, [petId, fetcher, reloadToken]);

  const warnings = useMemo(
    () => (profile ? computeExpiryWarnings(profile.fields, now()) : []),
    [profile, now],
  );

  const requestRemoval = useCallback((field: EmergencyProfileField) => {
    setPendingRemoval(field);
  }, []);

  const cancelRemoval = useCallback(() => {
    setPendingRemoval(null);
  }, []);

  const setFieldExpiry = useCallback(
    async (fieldId: string, expiresAt: string | null) => {
      if (!petId) return;
      const controller = new AbortController();
      try {
        const data = await updater(petId, fieldId, expiresAt, controller.signal);
        setProfile(data);
        setStatus('ready');
        setError(null);
      } catch (err: unknown) {
        const denied = Boolean((err as { denied?: boolean } | null)?.denied);
        setStatus(denied ? 'denied' : 'error');
        setError(denied ? null : err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [petId, updater],
  );

  const confirmRemoval = useCallback(async () => {
    if (!pendingRemoval) return;
    const field = pendingRemoval;
    setPendingRemoval(null);
    await setFieldExpiry(field.id, null);
  }, [pendingRemoval, setFieldExpiry]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return {
    status,
    profile,
    warnings,
    error,
    pendingRemoval,
    requestRemoval,
    cancelRemoval,
    confirmRemoval,
    setFieldExpiry,
    reload,
  };
}
