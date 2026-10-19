/**
 * SSR-safe analytics initialization.
 *
 * Browser-only capabilities (window, navigator, service workers, analytics
 * SDKs) must never be touched during server rendering or `next build`.
 * All access is guarded behind an explicit client check and consent gate.
 */

const isBrowser = typeof window !== "undefined";

let initialized = false;
let consentGranted = false;

/**
 * No-op server path. On the server this does nothing and never touches
 * browser globals, so `next build` and SSR stay safe.
 */
export function initAnalytics(): void {
  if (!isBrowser) {
    return;
  }
  if (initialized) {
    return;
  }
  initialized = true;
  // Analytics SDK wiring happens here once consent is known.
}

/**
 * Record consent. Analytics must not emit a pageview before consent is known,
 * so pageviews are dropped until this is called with `true`.
 */
export function setAnalyticsConsent(granted: boolean): void {
  consentGranted = granted;
  if (granted) {
    initAnalytics();
  }
}

/**
 * Emit a pageview. No-op on the server and while consent is unknown/denied.
 */
export function trackPageview(path: string): void {
  if (!isBrowser || !consentGranted) {
    return;
  }
  // Forward to the analytics provider once consent is granted.
  void path;
}
