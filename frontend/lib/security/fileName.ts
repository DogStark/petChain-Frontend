/**
 * Secure file-name handling for medical uploads.
 *
 * User-controlled file names can create misleading UI, unsafe download names,
 * or path-like values in logs and storage keys. This module keeps the display
 * name (escaped + normalized) separate from the storage identifier, rejects or
 * safely rewrites dangerous input, and produces safe Content-Disposition values.
 */

/** Maximum length (in code points) allowed for a sanitized display name. */
export const MAX_DISPLAY_NAME_LENGTH = 255;

/** Fallback used when a name is empty or fully stripped. */
export const FALLBACK_DISPLAY_NAME = 'unnamed-file';

/**
 * Bidi / directional formatting controls that can visually reorder text and
 * disguise the real extension or name. Stripped from display names.
 */
const BIDI_CONTROL_CHARS = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C]/g;

/** C0/C1 control characters (including NUL, newlines, tabs, DEL). */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/** Characters that are unsafe in file names across common filesystems. */
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*]/g;

/** Path traversal / path-like segments. */
const PATH_TRAVERSAL = /(\.\.(?:[\/\\]|$)|[\/\\])/g;

/** Reserved Windows device names (case-insensitive, with or without extension). */
const RESERVED_DEVICE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Normalize a raw user-supplied file name into a safe display name.
 *
 * - Strips path components and traversal sequences.
 * - Removes control characters and bidi overrides.
 * - Replaces unsafe filesystem characters.
 * - Collapses whitespace and trims leading/trailing dots and spaces.
 * - Enforces a maximum length while preserving the extension.
 *
 * The result is safe to render (after HTML escaping) and never contains
 * path-like values. It is NOT a storage identifier.
 */
export function sanitizeDisplayName(rawName: string): string {
  if (typeof rawName !== 'string') {
    return FALLBACK_DISPLAY_NAME;
  }

  // Normalize Unicode so visually identical names compare consistently.
  let name = rawName.normalize('NFC');

  // Drop any directory components (handles both / and \ separators).
  name = name.replace(PATH_TRAVERSAL, ' ');

  // Remove control characters and bidi overrides.
  name = name.replace(CONTROL_CHARS, '').replace(BIDI_CONTROL_CHARS, '');

  // Replace characters that are unsafe in file names.
  name = name.replace(UNSAFE_FILENAME_CHARS, '_');

  // Collapse whitespace runs and trim.
  name = name.replace(/\s+/g, ' ').trim();

  // Strip leading/trailing dots and spaces (hidden files, trailing-dot issues).
  name = name.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');

  if (name.length === 0) {
    return FALLBACK_DISPLAY_NAME;
  }

  // Avoid reserved device names on Windows.
  if (RESERVED_DEVICE_NAMES.test(name)) {
    name = `_${name}`;
  }

  return truncatePreservingExtension(name, MAX_DISPLAY_NAME_LENGTH);
}

/**
 * Truncate a name to `maxLength` code points while keeping the extension.
 */
function truncatePreservingExtension(name: string, maxLength: number): string {
  const chars = Array.from(name);
  if (chars.length <= maxLength) {
    return name;
  }

  const dotIndex = name.lastIndexOf('.');
  let ext = '';
  if (dotIndex > 0 && dotIndex < name.length - 1) {
    ext = name.slice(dotIndex);
    // Guard against absurdly long "extensions".
    if (Array.from(ext).length > 20) {
      ext = '';
    }
  }

  const extChars = Array.from(ext);
  const baseBudget = Math.max(1, maxLength - extChars.length);
  const base = chars.slice(0, baseBudget).join('');
  return `${base}${ext}`;
}

/**
 * Escape a display name for safe insertion into HTML text content.
 * Use this when the name is rendered outside of a framework that escapes by
 * default (e.g. manual innerHTML, template strings, logs shown in the UI).
 */
export function escapeDisplayName(name: string): string {
  return name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a stable, collision-resistant storage identifier from a raw name.
 *
 * The identifier is derived from the sanitized name plus a random suffix so
 * duplicate uploads never overwrite each other. It contains only a safe
 * character set and is independent of the display name.
 */
export function buildStorageId(rawName: string, uniqueSuffix?: string): string {
  const safe = sanitizeDisplayName(rawName)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  const base = safe.length > 0 ? safe : FALLBACK_DISPLAY_NAME;
  const suffix = uniqueSuffix ?? randomSuffix();
  return `${suffix}-${base}`;
}

function randomSuffix(): string {
  const cryptoObj =
    typeof globalThis !== 'undefined'
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Produce a safe `Content-Disposition` header value for downloads.
 *
 * Uses an ASCII-only `filename` fallback plus an RFC 5987 `filename*` that
 * carries the original (sanitized) name as metadata. The original raw name is
 * never placed directly into the header.
 */
export function buildContentDisposition(
  rawName: string,
  disposition: 'attachment' | 'inline' = 'attachment',
): string {
  const displayName = sanitizeDisplayName(rawName);

  // ASCII-only fallback: replace non-ASCII and quotes/backslashes.
  const asciiFallback =
    displayName
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '_') || FALLBACK_DISPLAY_NAME;

  const encoded = encodeURIComponent(displayName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Convenience wrapper returning both the safe display name and the storage id,
 * keeping the two concerns explicitly separate for callers.
 */
export interface SecureFileName {
  /** Escaped, normalized name safe for display. */
  displayName: string;
  /** Raw sanitized name (unescaped) for metadata. */
  metadataName: string;
  /** Collision-resistant storage identifier. */
  storageId: string;
}

export function processFileName(rawName: string, uniqueSuffix?: string): SecureFileName {
  const metadataName = sanitizeDisplayName(rawName);
  return {
    displayName: escapeDisplayName(metadataName),
    metadataName,
    storageId: buildStorageId(rawName, uniqueSuffix),
  };
}
