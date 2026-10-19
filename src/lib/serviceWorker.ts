/**
 * SSR-safe service-worker registration helpers.
 *
 * All browser-only access is guarded so this module can be imported during
 * server rendering / `next build` without touching `window` or `navigator`.
 */

const REGISTRATION_FLAG = '__sw_registered__';

/**
 * Returns true when running in a browser environment where service workers
 * are available. Safe to call during SSR (returns false on the server).
 */
export function canRegisterServiceWorker(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator === 'undefined') return false;
  return 'serviceWorker' in navigator;
}

/**
 * No-op server path. On the server this does nothing; in the browser it
 * registers the service worker exactly once per browser session.
 *
 * Idempotency is enforced both in-memory (module-level flag) and on the
 * `window` object so repeated calls across bundles/HMR do not re-register.
 */
export function registerServiceWorker(scriptPath = '/sw.js'): void {
  if (!canRegisterServiceWorker()) return;

  const globalWindow = window as unknown as Record<string, unknown>;
  if (globalWindow[REGISTRATION_FLAG]) return;
  globalWindow[REGISTRATION_FLAG] = true;

  try {
    navigator.serviceWorker.register(scriptPath).catch(() => {
      // Registration failures must never break rendering; allow a retry.
      globalWindow[REGISTRATION_FLAG] = false;
    });
  } catch {
    globalWindow[REGISTRATION_FLAG] = false;
  }
}
