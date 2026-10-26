/**
 * Identifier masking helpers used by the privacy-aware analytics export preview.
 *
 * Masking is intentionally dumb and deterministic:
 * - it never throws on missing/short/odd input,
 * - running it twice produces the same output as running it once, so a value
 *   that was already masked upstream cannot leak more detail on re-render.
 *
 * These helpers are a defence-in-depth layer in the UI. Whether personal data
 * may be exported unmasked at all is decided by the backend, never here.
 */

const BULLET = '•';

/** Placeholder returned for empty input. */
const EMPTY = '';

function asText(value: unknown): string {
  if (value === null || value === undefined) return EMPTY;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return EMPTY;
}

function bullets(count: number): string {
  return BULLET.repeat(Math.max(count, 1));
}

/**
 * Masks an email address while keeping it recognisable:
 * `jane@example.com` → `j•••@e•••.com`.
 *
 * Values without an `@` fall back to {@link maskIdentifier}.
 */
export function maskEmail(value: unknown): string {
  const text = asText(value);
  if (!text) return EMPTY;

  const at = text.indexOf('@');
  if (at < 1) return maskIdentifier(text);

  const local = text.slice(0, at);
  const domain = text.slice(at + 1);
  const maskedLocal = `${local.charAt(0)}${bullets(3)}`;

  if (!domain.includes('.')) {
    return `${maskedLocal}@${domain.charAt(0)}${bullets(3)}`;
  }

  const [host, ...rest] = domain.split('.');
  const tld = rest.join('.');
  return `${maskedLocal}@${host.charAt(0)}${bullets(3)}.${tld}`;
}

/**
 * Masks an opaque identifier (user id, account id, record id) while keeping a
 * stable prefix and the last four characters: `usr_8f2a9b31` → `usr_••••9b31`.
 */
export function maskIdentifier(value: unknown): string {
  const text = asText(value);
  if (!text) return EMPTY;
  if (text.length <= 4) return bullets(text.length);

  const separatorIndex = text.indexOf('_');
  const prefix = separatorIndex > 0 && separatorIndex < 6 ? text.slice(0, separatorIndex + 1) : text.slice(0, 3);
  const suffix = text.slice(-4);
  const hiddenLength = Math.max(text.length - prefix.length - suffix.length, 4);

  return `${prefix}${bullets(hiddenLength)}${suffix}`;
}

/**
 * Masks free text such as a region or name: `North America` → `Nor•••`.
 * Short values (4 characters or fewer) are masked completely.
 */
export function maskText(value: unknown): string {
  const text = asText(value);
  if (!text) return EMPTY;
  if (text.length <= 4) return bullets(text.length);
  return `${text.slice(0, 3)}${bullets(3)}`;
}

/** How a personal-data field should be masked. */
export type MaskKind = 'email' | 'identifier' | 'text';

/** Applies the mask matching `kind` to `value`. */
export function maskValue(kind: MaskKind, value: unknown): string {
  switch (kind) {
    case 'email':
      return maskEmail(value);
    case 'identifier':
      return maskIdentifier(value);
    case 'text':
    default:
      return maskText(value);
  }
}
