/**
 * attachmentValidation.ts
 *
 * Shared validation logic for medical lab-report attachments.
 * Runs on the client (UploadModal) and on the server (Next.js API route).
 *
 * Security assumptions documented here:
 *  - MIME-type allowlist is the primary type gate.  Browser-supplied MIME
 *    types are untrusted, so the server MUST re-check the magic bytes.
 *  - The 10 MB limit protects both the upload budget and downstream storage.
 *  - Filename sanitization prevents path traversal and stored-XSS vectors.
 *  - The malware-scan hook is a stub that callers replace in production
 *    (e.g. ClamAV, AWS Malware Protection for S3).
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** MIME types accepted for medical attachments. */
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
]);

/** Human-readable label shown in error messages. */
export const ALLOWED_EXTENSIONS_LABEL = 'PDF';

/** Maximum allowed file size in bytes (10 MB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Maximum filename length (characters, excluding the extension). */
export const MAX_FILENAME_LENGTH = 200;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ValidationResult {
  /** true when the file passes every check. */
  valid: boolean;
  /** Human-readable rejection reason, or undefined when valid. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Individual validators
// ---------------------------------------------------------------------------

/**
 * Returns true when the MIME type is in the explicit allowlist.
 * NOTE: On the server you must also verify the file magic bytes.
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

/** Returns true when the file size is within the configured limit. */
export function isWithinSizeLimit(sizeBytes: number): boolean {
  return sizeBytes <= MAX_FILE_SIZE_BYTES;
}

/**
 * Returns a sanitized filename string, or null if the name is
 * fundamentally unsafe and must be rejected.
 *
 * Rules enforced:
 *  1. Path separators and null bytes – reject (path-traversal).
 *  2. HTML special characters (<, >, ", ', &) – reject (stored-XSS).
 *  3. Length > MAX_FILENAME_LENGTH – reject.
 *  4. Leading/trailing whitespace – stripped.
 *  5. Control characters – stripped.
 *
 * The function returns the sanitized name so callers can display it;
 * a null return means the file must be rejected entirely.
 */
export function sanitizeFilename(filename: string): string | null {
  // Reject immediately if a null byte is present (before any stripping)
  if (filename.includes('\0')) {
    return null;
  }

  // Strip leading/trailing whitespace
  let name = filename.trim();

  // Remove ASCII control characters (0x01–0x1F, 0x7F) — null already guarded above
  name = name.replace(/[\x01-\x1F\x7F]/g, '');

  // Reject path-traversal sequences
  if (/[/\\]/.test(name) || name.includes('..')) {
    return null;
  }

  // Reject HTML injection characters
  if (/[<>"'&]/.test(name)) {
    return null;
  }

  // Reject if still empty after stripping
  if (name.length === 0) {
    return null;
  }

  // Reject excessively long filenames
  if (name.length > MAX_FILENAME_LENGTH) {
    return null;
  }

  return name;
}

// ---------------------------------------------------------------------------
// Composite client-side validator
// ---------------------------------------------------------------------------

/**
 * Validates a File object on the client side.
 *
 * Checks, in order:
 *  1. MIME-type allowlist
 *  2. File size limit
 *  3. Filename safety
 */
export function validateAttachment(file: File): ValidationResult {
  if (!isAllowedMimeType(file.type)) {
    return {
      valid: false,
      error: `Only ${ALLOWED_EXTENSIONS_LABEL} files are accepted. The selected file type (${file.type || 'unknown'}) is not allowed.`,
    };
  }

  if (!isWithinSizeLimit(file.size)) {
    const limitMB = MAX_FILE_SIZE_BYTES / (1024 * 1024);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${fileMB} MB). The maximum allowed size is ${limitMB} MB.`,
    };
  }

  const sanitized = sanitizeFilename(file.name);
  if (sanitized === null) {
    return {
      valid: false,
      error: `Invalid filename "${file.name}". Filenames must not contain path separators, HTML characters, or be longer than ${MAX_FILENAME_LENGTH} characters.`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Server-side validator (Node.js / Next.js API routes)
// ---------------------------------------------------------------------------

/**
 * Parameters for the server-side validation hook.
 * Matches the shape of data available in a Next.js API route after parsing
 * a multipart/form-data body with a library such as formidable or busboy.
 */
export interface ServerAttachmentParams {
  /** The MIME type declared by the client – untrusted, re-check with magic bytes. */
  declaredMimeType: string;
  /** First 8 bytes of the file content for magic-byte verification. */
  magicBytes: Uint8Array;
  /** File size in bytes. */
  sizeBytes: number;
  /** Original filename from the multipart header. */
  originalFilename: string;
}

/**
 * PDF magic bytes: every valid PDF starts with "%PDF-" (25 50 44 46 2D).
 */
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

/** Checks whether the first bytes of a buffer match the PDF magic sequence. */
export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  for (let i = 0; i < PDF_MAGIC.length; i++) {
    if (bytes[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Server-side composite validator.
 *
 * Adds magic-byte verification on top of the client checks so that a file
 * whose MIME type was spoofed by the client is caught before storage.
 *
 * Malware scanning is delegated to the `scanForMalware` hook.  In
 * production supply a real implementation; the default no-op is safe for
 * development only.
 */
export async function validateAttachmentServer(
  params: ServerAttachmentParams,
  /**
   * Malware-scan hook.  Returns a rejection reason string if the scan
   * detects a threat, or null/undefined if the file is clean.
   *
   * Replace with a real ClamAV / cloud scanning integration in production.
   */
  scanForMalware: (params: ServerAttachmentParams) => Promise<string | null> = async () => null,
): Promise<ValidationResult> {
  // 1. MIME type allowlist (declared)
  if (!isAllowedMimeType(params.declaredMimeType)) {
    return {
      valid: false,
      error: `Only ${ALLOWED_EXTENSIONS_LABEL} files are accepted.`,
    };
  }

  // 2. Magic-byte verification (guards against MIME-type spoofing)
  if (!hasPdfMagicBytes(params.magicBytes)) {
    return {
      valid: false,
      error: 'File content does not match its declared type. Only real PDF files are accepted.',
    };
  }

  // 3. File size
  if (!isWithinSizeLimit(params.sizeBytes)) {
    const limitMB = MAX_FILE_SIZE_BYTES / (1024 * 1024);
    return {
      valid: false,
      error: `File exceeds the ${limitMB} MB size limit.`,
    };
  }

  // 4. Filename safety
  const sanitized = sanitizeFilename(params.originalFilename);
  if (sanitized === null) {
    return {
      valid: false,
      error: `Invalid filename. Filenames must not contain path separators, HTML characters, or exceed ${MAX_FILENAME_LENGTH} characters.`,
    };
  }

  // 5. Malware scan
  const threatReason = await scanForMalware(params);
  if (threatReason) {
    return { valid: false, error: `File rejected: ${threatReason}` };
  }

  return { valid: true };
}
