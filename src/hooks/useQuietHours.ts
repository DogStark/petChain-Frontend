import { useCallback, useEffect, useState } from 'react';

export interface QuietHoursConfig {
  enabled: boolean;
  startTime: string;   // "HH:MM" in the user's timezone
  endTime: string;     // "HH:MM" in the user's timezone
  timezone: string;    // IANA timezone string, e.g. "America/New_York"
  allowUrgent: boolean;
}

const STORAGE_KEY = 'petchain-quiet-hours';

const DEFAULT_CONFIG: QuietHoursConfig = {
  enabled: false,
  startTime: '22:00',
  endTime: '08:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  allowUrgent: true,
};

function load(): QuietHoursConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<QuietHoursConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function save(config: QuietHoursConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // quota exceeded — changes are still live for this session
  }
}

/** Returns true when the current local time falls inside the quiet window. */
export function isInQuietHours(config: QuietHoursConfig): boolean {
  if (!config.enabled) return false;
  const now = new Date();
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const start = fmt(config.startTime);
  const end = fmt(config.endTime);
  // Handle overnight ranges (e.g. 22:00 → 08:00)
  return start <= end ? nowMins >= start && nowMins < end : nowMins >= start || nowMins < end;
}

export function useQuietHours() {
  const [config, setConfig] = useState<QuietHoursConfig>(load);

  useEffect(() => {
    save(config);
  }, [config]);

  const update = useCallback((patch: Partial<QuietHoursConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setConfig(DEFAULT_CONFIG), []);

  return { config, update, reset, isActive: isInQuietHours(config) };
}
