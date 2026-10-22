import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type QuietHoursPolicy = 'local' | 'home';

export interface QuietHoursConfig {
  enabled: boolean;
  start: string; // "HH:MM" local wall-clock time
  end: string; // "HH:MM" local wall-clock time
  timezone: string; // IANA timezone the user configured quiet hours in
  travelPolicy: QuietHoursPolicy;
}

export interface QuietHoursState {
  config: QuietHoursConfig;
  /** True when the device timezone differs from the configured quiet-hours timezone. */
  timezoneChanged: boolean;
  /** The device timezone currently detected by the browser. */
  deviceTimezone: string;
  /** True when the current local time falls inside the quiet-hours window. */
  isQuietNow: boolean;
  /** True when the backend has not yet confirmed the config (authorization/consent owned by backend). */
  pendingBackend: boolean;
  /** Set when the backend rejected or denied the configuration. */
  denied: boolean;
  error: string | null;
}

export interface UseQuietHoursOptions {
  /** Initial config, typically hydrated from the backend. */
  initialConfig?: Partial<QuietHoursConfig>;
  /**
   * Persist the config. The backend owns authorization and consent decisions;
   * resolve with the accepted config or reject/return a denial signal.
   */
  onSave?: (config: QuietHoursConfig) => Promise<QuietHoursConfig | void>;
  /** Injectable clock for tests. */
  now?: () => Date;
}

const DEFAULT_CONFIG: QuietHoursConfig = {
  enabled: false,
  start: '22:00',
  end: '07:00',
  timezone: 'UTC',
  travelPolicy: 'local',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function minutesFromTime(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/** Returns true when `date` (in `timezone`) falls within [start, end), handling overnight windows. */
export function isWithinQuietHours(
  date: Date,
  start: string,
  end: string,
  timezone: string,
): boolean {
  if (!isValidTime(start) || !isValidTime(end)) return false;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
  } catch {
    return false;
  }
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const current = hour * 60 + minute;
  const startMin = minutesFromTime(start);
  const endMin = minutesFromTime(end);
  if (startMin === endMin) return false;
  if (startMin < endMin) return current >= startMin && current < endMin;
  // Overnight window, e.g. 22:00 -> 07:00
  return current >= startMin || current < endMin;
}

/**
 * Resolves which timezone quiet hours should be evaluated in when the device
 * timezone changes (travel). `local` follows the device; `home` keeps the
 * originally configured timezone.
 */
export function resolveQuietHoursTimezone(
  config: QuietHoursConfig,
  deviceTimezone: string,
): string {
  return config.travelPolicy === 'home' ? config.timezone : deviceTimezone;
}

export function useQuietHours(options: UseQuietHoursOptions = {}): QuietHoursState & {
  updateConfig: (patch: Partial<QuietHoursConfig>) => void;
  save: () => Promise<void>;
  reset: () => void;
} {
  const { initialConfig, onSave, now } = options;
  const clock = useMemo(() => now ?? (() => new Date()), [now]);

  const [config, setConfig] = useState<QuietHoursConfig>(() => ({
    ...DEFAULT_CONFIG,
    timezone: detectTimezone(),
    ...initialConfig,
  }));
  const [deviceTimezone, setDeviceTimezone] = useState<string>(() => detectTimezone());
  const [pendingBackend, setPendingBackend] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Detect timezone changes (travel) without deciding authorization.
  useEffect(() => {
    const check = () => {
      const next = detectTimezone();
      setDeviceTimezone((prev) => (prev === next ? prev : next));
    };
    check();
    const interval = setInterval(check, 60_000);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', check);
    };
  }, []);

  const timezoneChanged = deviceTimezone !== config.timezone;

  const isQuietNow = useMemo(() => {
    if (!config.enabled) return false;
    const tz = resolveQuietHoursTimezone(config, deviceTimezone);
    return isWithinQuietHours(clock(), config.start, config.end, tz);
  }, [config, deviceTimezone, clock]);

  const updateConfig = useCallback((patch: Partial<QuietHoursConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setDenied(false);
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (!isValidTime(config.start) || !isValidTime(config.end)) {
      setError('Quiet hours must use valid HH:MM times.');
      return;
    }
    if (!onSave) return;
    setPendingBackend(true);
    setDenied(false);
    setError(null);
    try {
      const accepted = await onSave(config);
      if (!mounted.current) return;
      if (accepted) setConfig((prev) => ({ ...prev, ...accepted }));
    } catch (err) {
      if (!mounted.current) return;
      const message = err instanceof Error ? err.message : 'Unable to save quiet hours.';
      setError(message);
      setDenied(true);
    } finally {
      if (mounted.current) setPendingBackend(false);
    }
  }, [config, onSave]);

  const reset = useCallback(() => {
    setConfig({ ...DEFAULT_CONFIG, timezone: detectTimezone(), ...initialConfig });
    setDenied(false);
    setError(null);
  }, [initialConfig]);

  return {
    config,
    timezoneChanged,
    deviceTimezone,
    isQuietNow,
    pendingBackend,
    denied,
    error,
    updateConfig,
    save,
    reset,
  };
}
