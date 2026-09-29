/**
 * URL policy for safe external-link handling on medical and wallet screens.
 *
 * - Validate allowlisted origins
 * - Strip sensitive query / hash data before navigating
 * - Reject unknown destinations (caller decides whether to block or confirm)
 */

/** Origins explicitly trusted by the application. */
const ALLOWED_ORIGINS = new Set([
  'stellar.expert',
  'google.com',
  'maps.google.com',
  'www.google.com',
  'www.maps.google.com',
]);

/** Query-parameter names that must never be forwarded to an external destination. */
const SENSITIVE_QUERY_PARAMS = new Set([
  'token',
  'access_token',
  'auth',
  'session',
  'sid',
  'csrf',
  '_csrf',
  '__Host-session',
  'state',
  'code',
  'redirect_uri',
  'callback',
  'sig',
  'signature',
  'api_key',
  'apikey',
  'secret',
  'key',
  'password',
  'passwd',
  'pwd',
]);

/** Query-parameter names that are safe to keep (allowlist approach). */
const SAFE_QUERY_PARAMS = new Set([
  'q',
  'query',
  'destination',
  'api',
  'center',
  'zoom',
  'lat',
  'lng',
  'daddr',
  'saddr',
  'dir',
  'mode',
  'avoid',
  'waypoints',
  'origin',
  'search',
  'place',
  'cid',
  'gl',
  'hl',
  'll',
  'spn',
  'z',
]);

/**
 * Parse a URL string and return its origin (scheme + host), or null if
 * the string is not a valid absolute URL.
 */
function getOrigin(href: string): string | null {
  try {
    const url = new URL(href, 'https://localhost');
    return url.origin.replace(/^https?:\/\//, '');
  } catch {
    return null;
  }
}

/**
 * Return `true` when the href is either a same-origin relative path or
 * its origin is present in the allowlist.
 */
export function isAllowedOrigin(href: string): boolean {
  try {
    const url = new URL(href, 'https://localhost');
    // Relative / same-origin paths are always allowed.
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const host = url.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        return true;
      }
      return ALLOWED_ORIGINS.has(host) || ALLOWED_ORIGINS.has(`www.${host}`);
    }
    // Non-http schemes (tel:, mailto:, sms:) are allowed by default.
    if (url.protocol === 'tel:' || url.protocol === 'mailto:' || url.protocol === 'sms:') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Strip sensitive query parameters and hash fragments from an absolute URL.
 * Only parameters present in SAFE_QUERY_PARAMS are preserved; everything else
 * is removed. The hash is always removed.
 */
export function stripSensitiveParams(href: string): string {
  try {
    const url = new URL(href, 'https://localhost');
    // Remove the hash entirely — it can contain session tokens or tracking data.
    url.hash = '';

    // Rebuild the query string keeping only safe parameters.
    const safeParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (SAFE_QUERY_PARAMS.has(key.toLowerCase())) {
        safeParams.append(key, value);
      }
    }
    url.search = safeParams.toString();

    return url.toString();
  } catch {
    // If parsing fails, return the original href unchanged.
    return href;
  }
}

/**
 * Full URL policy check: returns `{ allowed: boolean; cleanedHref?: string }`.
 * - `allowed` is `true` when the origin is on the allowlist (or the URL is
 *   relative / same-origin / a safe non-http scheme).
 * - `cleanedHref` is the URL with sensitive query params and hash stripped.
 */
export function checkUrlPolicy(href: string): { allowed: boolean; cleanedHref?: string } {
  if (!href) {
    return { allowed: false };
  }

  // Allow relative links (e.g. "/clinics/123") — they never leave the app.
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('?')) {
    return { allowed: true, cleanedHref: href };
  }

  if (!isAllowedOrigin(href)) {
    return { allowed: false };
  }

  return { allowed: true, cleanedHref: stripSensitiveParams(href) };
}
