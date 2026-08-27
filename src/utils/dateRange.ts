import { subDays, formatDistanceToNowStrict } from 'date-fns';

/** Returns an ISO string for N days ago from now. */
export function daysAgo(n: number): string {
  return subDays(new Date(), n).toISOString();
}

/**
 * Returns a human-readable relative time string, e.g. "5 minutes ago",
 * "3 hours ago", "2 days ago".
 */
export function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true });
}
