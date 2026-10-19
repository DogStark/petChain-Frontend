/**
 * Secure file-name handling for medical uploads.
 *
 * User-controlled file names can create misleading UI, unsafe download names,
 * or path-like values in logs and storage keys. This module keeps the display
 * name (escaped + normalized) separate from the storage identifier (opaque,
 * derived from a sanitized base name), and produces safe Content-Disposition
 * values for downloads while preserving the original name only as metadata.
 */

const MAX_BASE_NAME_LENGTH = 100;
const MAX_DISPLAY_NAME_LENGTH = 255;
const MAX_EXTENSION_LENGTH = 16;

// Unicode bidi control characters (e.g. RLO/LRO/PDF) that can visually spoof
// file names. Stripped from both display and storage names.
const BIDI_CONTROL_CHARS = /[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g;

// C0/C1 control characters plus DEL.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

// Path separators and traversal markers.
const PATH_SEPARATORS = /[\\/]+/g;
const TRAVERSAL_SEQUENCE = /(^|[^A-Za-z0-9])\.\.([^A-Za-z0-9]|$)/;

// Characters that are unsafe in storage keys / Content-Disposition tokens.
const UNSAFE_STORAGE_CHARS = /[^A-Za-z0-9._-]+/g;

// Characters that are unsafe inside a quoted Content-Disposition filename.
const UNSAFE_HEADER_CHARS = /[\r\n"\\]/g;

export interface SafeFileName {
  /** Escaped, normalized name safe to render in the UI. */
  displayName: string;
  /** Opaque, path-free identifier safe for storage keys and logs. */
  storageId: string;
  /** Original, unmodified name preserved only as metadata. */
  originalName: string;
  /** Lowercased extension without the leading dot, or empty string. */
  extension: string;
  /** True when the input required rewriting or truncation. */
  sanitized: boolean;
}

/**
 * Split a raw file name into a base name and a safe extension.
 * Traversal sequences and path separators are removed before splitting.
 */
function splitName(rawName: string): { base: string; extension: string } {
  const withoutPaths = rawName.replace(PATH_SEPARATORS, " ");
  const lastDot = withoutPaths.lastIndexOf(".");

  if (lastDot <= 0 || lastDot === withoutPaths.length - 1) {
    return { base: withoutPaths, extension: "" };
  }

  const extension = withoutPaths.slice(lastDot + 1);
  if (extension.length > MAX_EXTENSION_LENGTH || !/^[A-Za-z0-9]+$/.test(extension)) {
    return { base: withoutPaths, extension: "" };
  }

  return { base: withoutPaths.slice(0, lastDot), extension: extension.toLowerCase() };
}

/**
 * Normalize a user-controlled file name into a safe display name and a
 * separate, path-free storage identifier.
 */
export function sanitizeFileName(rawName: string): SafeFileName {
  const originalName = typeof rawName === "string" ? rawName : "";

  // Strip control and bidi characters, then collapse whitespace.
  const stripped = originalName
    .replace(CONTROL_CHARS, "")
    .replace(BIDI_CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();

  const { base, extension } = splitName(stripped);

  // Reject traversal markers by rewriting them out of the base name.
  const traversalFree = base.replace(/\.\./g, "_").replace(/^\.+/, "");

  const safeBase = traversalFree
    .replace(UNSAFE_STORAGE_CHARS, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, MAX_BASE_NAME_LENGTH);

  const fallbackBase = safeBase.length > 0 ? safeBase : "file";
  const storageId = extension ? `${fallbackBase}.${extension}` : fallbackBase;

  const displayBase = traversalFree.replace(/\s+/g, " ").trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  const displayName = extension
    ? `${displayBase || "file"}.${extension}`
    : displayBase || "file";

  const sanitized =
    displayName !== originalName ||
    storageId !== originalName ||
    TRAVERSAL_SEQUENCE.test(originalName);

  return {
    displayName,
    storageId,
    originalName,
    extension,
    sanitized,
  };
}

/**
 * Build a safe Content-Disposition header value for a download.
 * The original name is preserved only as metadata (via the storage id),
 * never used directly in the header.
 */
export function buildContentDisposition(
  rawName: string,
  disposition: "attachment" | "inline" = "attachment",
): string {
  const { storageId } = sanitizeFileName(rawName);
  const safeAscii = storageId.replace(UNSAFE_HEADER_CHARS, "_").replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(storageId).replace(/['()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${disposition}; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}

/**
 * Ensure a storage identifier is unique within a set of existing identifiers.
 * Duplicate names receive a numeric suffix before the extension.
 */
export function uniqueStorageId(storageId: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  if (!taken.has(storageId)) {
    return storageId;
  }

  const dot = storageId.lastIndexOf(".");
  const base = dot > 0 ? storageId.slice(0, dot) : storageId;
  const extension = dot > 0 ? storageId.slice(dot) : "";

  let counter = 1;
  let candidate = `${base}-${counter}${extension}`;
  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}${extension}`;
  }

  return candidate;
}
