import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Documented revalidation interval for public profile views.
 *
 * Public profiles are cached aggressively (CDN + browser + service worker),
 * so a revocation performed in another tab/device would otherwise leave an
 * already-open view showing stale data until a manual reload. We therefore
 * revalidate on window focus and at this fixed interval.
 */
export const PUBLIC_PROFILE_REVALIDATE_INTERVAL_MS = 30_000;

/**
 * Fields that must never be exposed once a profile has been revoked.
 * They are masked (not deleted) so the UI keeps a stable shape while the
 * revocation reason stays hidden from the public viewer.
 */
export const PROTECTED_PUBLIC_PROFILE_FIELDS = [
  'displayName',
  'avatarUrl',
  'bio',
  'email',
  'phone',
  'links',
  'metadata',
] as const;

export type PublicProfile = {
  id: string;
  revoked?: boolean;
  revokedAt?: string | null;
  expiresAt?: string | null;
  [key: string]: unknown;
};

export type PublicProfileState = {
  profile: PublicProfile | null;
  loading: boolean;
  error: Error | null;
  revoked: boolean;
  revalidate: () => Promise<void>;
};

/**
 * Mask protected fields on a revoked profile without leaking the reason.
 * The revocation reason is intentionally dropped here so it can never be
 * rendered by a public view.
 */
export function maskRevokedProfile(profile: PublicProfile): PublicProfile {
  const masked: PublicProfile = {
    id: profile.id,
    revoked: true,
    revokedAt: profile.revokedAt ?? null,
    expiresAt: profile.expiresAt ?? null,
  };
  for (const field of PROTECTED_PUBLIC_PROFILE_FIELDS) {
    if (field in profile) {
      masked[field] = null;
    }
  }
  return masked;
}

function isExpired(profile: PublicProfile, now: number): boolean {
  if (!profile.expiresAt) return false;
  const expires = Date.parse(profile.expiresAt);
  return Number.isFinite(expires) && expires <= now;
}

/**
 * Normalize a fetched profile: revoked or expired profiles are masked so
 * protected fields are removed and the revocation reason is never exposed.
 */
export function normalizePublicProfile(
  profile: PublicProfile | null,
  now: number = Date.now(),
): PublicProfile | null {
  if (!profile) return null;
  if (profile.revoked || isExpired(profile, now)) {
    return maskRevokedProfile(profile);
  }
  return profile;
}

/**
 * Fetch a public profile with cache-busting so browser caches and service
 * workers cannot resurrect a revoked profile.
 */
async function fetchPublicProfile(
  profileId: string,
  signal: AbortSignal,
): Promise<PublicProfile | null> {
  const url = new URL(`/api/public/profiles/${encodeURIComponent(profileId)}`, window.location.origin);
  url.searchParams.set('_ts', String(Date.now()));

  const response = await fetch(url.toString(), {
    method: 'GET',
    signal,
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  if (response.status === 404 || response.status === 410) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load public profile (${response.status})`);
  }
  return (await response.json()) as PublicProfile;
}

/**
 * Loads a public profile and keeps it fresh across tabs/devices.
 *
 * Revalidation happens on window focus and every
 * PUBLIC_PROFILE_REVALIDATE_INTERVAL_MS. A monotonically increasing request
 * id guards against out-of-order responses (race conditions) so a slow
 * pre-revocation response can never overwrite a newer revoked state.
 */
export function usePublicProfile(profileId: string | null | undefined): PublicProfileState {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(profileId));
  const [error, setError] = useState<Error | null>(null);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const revalidate = useCallback(async () => {
    if (!profileId) return;

    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const next = await fetchPublicProfile(profileId, controller.signal);
      // Ignore stale responses from earlier requests.
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setProfile(normalizePublicProfile(next));
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [profileId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!profileId) {
      setProfile(null);
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    setLoading(true);
    void revalidate();

    const interval = window.setInterval(() => {
      void revalidate();
    }, PUBLIC_PROFILE_REVALIDATE_INTERVAL_MS);

    const onFocus = () => {
      void revalidate();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void revalidate();
      }
    };
    // Revalidate when connectivity returns after an offline period.
    const onOnline = () => {
      void revalidate();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      abortRef.current?.abort();
    };
  }, [profileId, revalidate]);

  return {
    profile,
    loading,
    error,
    revoked: Boolean(profile?.revoked),
    revalidate,
  };
}
