export interface OfflineRetentionPolicy {
  id: string;
  days: number;
  expiresAt: string | null;
}

export interface RetentionOption {
  id: string;
  label: string;
  days: number | null;
  description: string;
}

export const REVERSIBLE_RETENTION_DAYS = 7;

export const RETENTION_OPTIONS: RetentionOption[] = [
  {
    id: 'session',
    label: 'Session only',
    days: 0,
    description: 'Cached records are deleted when you close the app.',
  },
  {
    id: 'days-1',
    label: '1 day',
    days: 1,
    description: 'Cached records are deleted 24 hours after they are cached.',
  },
  {
    id: 'days-7',
    label: '7 days',
    days: 7,
    description: 'Cached records are deleted 7 days after they are cached.',
  },
  {
    id: 'days-30',
    label: '30 days',
    days: 30,
    description: 'Cached records are deleted 30 days after they are cached.',
  },
];

export const DELETED_LOCAL_DATA = [
  'Cached medical record copies stored on this device',
  'Offline record snapshots and attachments',
  'Local search indexes built from cached records',
];

export const NOT_DELETED_LOCAL_DATA = [
  'Your account credentials and session tokens',
  'Your settings and preferences',
];

export function findRetentionOption(id: string): RetentionOption | undefined {
  return RETENTION_OPTIONS.find((option) => option.id === id);
}

export function isValidRetentionId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  return RETENTION_OPTIONS.some((option) => option.id === id);
}

export function daysToExpiresAt(days: number, now: Date = new Date()): string | null {
  if (days <= 0) return null;
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return expiresAt.toISOString();
}

export function describeRetention(policy: OfflineRetentionPolicy | null): string {
  if (!policy) return 'No offline retention policy is currently set.';
  if (policy.days === 0) return 'Cached records are kept for this session only.';
  const label = policy.days === 1 ? '1 day' : `${policy.days} days`;
  return `Cached records are kept for ${label} and then deleted.`;
}
