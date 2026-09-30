import { apiClient } from './apiClient';

/**
 * Public profile service.
 *
 * Revocation propagation contract (issue #961):
 * - Public profile views revalidate on window focus and at a documented
 *   polling interval (PUBLIC_PROFILE_REVALIDATE_INTERVAL_MS).
 * - Revocation removes/masks protected fields without exposing the reason.
 * - Responses are fetched with `cache: 'no-store'` and a cache-busting
 *   timestamp so browser caches and service workers cannot resurrect the
 *   old profile after revocation.
 */

/** Documented revalidation interval for open public profile views. */
export const PUBLIC_PROFILE_REVALIDATE_INTERVAL_MS = 30_000;

/** Fields that must never be exposed once a profile is revoked. */
const PROTECTED_FIELDS = [
  'displayName',
  'bio',
  'avatarUrl',
  'email',
  'links',
  'socialLinks',
  'phone',
  'location',
] as const;

export interface PublicProfile {
  id: string;
  revoked?: boolean;
  expiresAt?: string | null;
  [key: string]: unknown;
}

export interface PublicProfileResult {
  profile: PublicProfile | null;
  revoked: boolean;
  expired: boolean;
}

/**
 * Mask a revoked/expired profile so protected fields are removed without
 * leaking the revocation reason to the client.
 */
export function maskRevokedProfile(
  profile: PublicProfile | null,
): PublicProfile | null {
  if (!profile) return null;
  const masked: PublicProfile = { id: profile.id, revoked: true };
  for (const field of PROTECTED_FIELDS) {
    if (field in masked) delete masked[field];
  }
  return masked;
}

function isExpired(profile: PublicProfile | null): boolean {
  if (!profile || !profile.expiresAt) return false;
  const expiresAt = Date.parse(profile.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

/**
 * Fetch a public profile with cache-busting so stale copies cannot be
 * served from the browser cache or a service worker after revocation.
 */
export async function fetchPublicProfile(
  profileId: string,
  signal?: AbortSignal,
): Promise<PublicProfileResult> {
  const response = await apiClient.get<PublicProfile>(
    `/public/profiles/${encodeURIComponent(profileId)}`,
    {
      signal,
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      params: { _ts: Date.now() },
    },
  );

  const profile = response.data ?? null;

  if (!profile || profile.revoked) {
    return { profile: maskRevokedProfile(profile), revoked: true, expired: false };
  }

  if (isExpired(profile)) {
    return { profile: maskRevokedProfile(profile), revoked: false, expired: true };
  }

  return { profile, revoked: false, expired: false };
}

/**
 * Subscribe a public profile view to revalidation on window focus and at
 * the documented polling interval. Returns an unsubscribe function.
 */
export function subscribePublicProfileRevalidation(
  profileId: string,
  onResult: (result: PublicProfileResult) => void,
): () => void {
  let disposed = false;
  let inFlight: AbortController | null = null;

  const revalidate = async () => {
    if (disposed) return;
    // Guard against overlapping requests (race conditions across tabs).
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    try {
      const result = await fetchPublicProfile(profileId, controller.signal);
      if (!disposed && !controller.signal.aborted) onResult(result);
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        // Swallow transient errors; the next tick will retry.
      }
    } finally {
      if (inFlight === controller) inFlight = null;
    }
  };

  const handleFocus = () => void revalidate();
  const handleOnline = () => void revalidate();

  window.addEventListener('focus', handleFocus);
  window.addEventListener('online', handleOnline);
  const intervalId = window.setInterval(
    () => void revalidate(),
    PUBLIC_PROFILE_REVALIDATE_INTERVAL_MS,
  );

  void revalidate();

  return () => {
    disposed = true;
    inFlight?.abort();
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('online', handleOnline);
    window.clearInterval(intervalId);
  };
}
