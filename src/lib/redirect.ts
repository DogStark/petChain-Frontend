/**
 * Post-authentication redirect validation.
 *
 * Only normalized same-origin application paths are allowed. External URLs,
 * protocol-relative URLs, backslash/encoded bypass payloads, and
 * `javascript:`/`data:` schemes are rejected. Safe deep links (path + query +
 * hash) are preserved after normalization.
 */

const FALLBACK_PATH = "/";

/**
 * Returns a safe, normalized same-origin application path for use as a
 * post-authentication redirect target, or the fallback when the input is
 * missing or unsafe.
 */
export function sanitizeRedirectTarget(
  raw: string | null | undefined,
  fallback: string = FALLBACK_PATH,
): string {
  if (typeof raw !== "string") {
    return fallback;
  }

  let candidate = raw.trim();
  if (candidate.length === 0) {
    return fallback;
  }

  // Decode repeatedly to catch double-encoded bypass payloads, but bail out on
  // malformed encoding rather than guessing.
  for (let i = 0; i < 3; i += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      return fallback;
    }
    if (decoded === candidate) {
      break;
    }
    candidate = decoded;
  }

  candidate = candidate.trim();

  // Reject control characters and whitespace that can smuggle schemes.
  if (/[\u0000-\u001f\u007f\s]/.test(candidate)) {
    return fallback;
  }

  // Reject backslashes: browsers treat `\\` like `/`, enabling `//evil.com`
  // style bypasses via `\\evil.com`.
  if (candidate.includes("\\")) {
    return fallback;
  }

  // Must be a root-relative path. This rejects absolute URLs, protocol-relative
  // URLs (`//evil.com`), and scheme payloads (`javascript:`, `data:`, ...).
  if (!candidate.startsWith("/")) {
    return fallback;
  }

  // Reject protocol-relative URLs (`//evil.com`).
  if (candidate.startsWith("//")) {
    return fallback;
  }

  // Normalize using the URL parser against a fixed origin so that dot segments
  // and other oddities are resolved, then confirm the result stays same-origin.
  let resolved: URL;
  try {
    resolved = new URL(candidate, "https://app.invalid");
  } catch {
    return fallback;
  }

  if (resolved.origin !== "https://app.invalid") {
    return fallback;
  }

  const normalized = `${resolved.pathname}${resolved.search}${resolved.hash}`;

  // Guard against normalization producing a protocol-relative or non-path
  // result.
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return fallback;
  }

  return normalized;
}
