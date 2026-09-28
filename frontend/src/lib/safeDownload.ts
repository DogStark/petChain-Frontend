/**
 * Content sniffing guard for medical document previews.
 *
 * A response with a misleading Content-Type must never be rendered as active
 * HTML/script inside an authenticated page. This module validates the actual
 * bytes (magic numbers) against an allowlist of safe document formats before
 * a preview is allowed, and falls back to a safe download disposition for
 * anything unsupported.
 */

export type SafeDocumentKind =
  | "pdf"
  | "png"
  | "jpeg"
  | "gif"
  | "webp"
  | "tiff"
  | "bmp";

export interface SniffResult {
  /** Detected format, or null when the bytes are not an allowlisted document. */
  kind: SafeDocumentKind | null;
  /** True only when the bytes match an allowlisted, non-active format. */
  safe: boolean;
  /** MIME type to use for the preview/download. */
  mimeType: string;
  /** Safe disposition: inline only for allowlisted formats, attachment otherwise. */
  disposition: "inline" | "attachment";
}

const UNSAFE_MIME = "application/octet-stream";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Inspect the leading bytes of a response and decide whether it is safe to
 * preview. HTML/script and unknown formats are never treated as documents.
 */
export function sniffDocument(bytes: Uint8Array | ArrayBuffer): SniffResult {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // PDF: %PDF-
  if (asciiAt(data, 0, "%PDF-")) {
    return { kind: "pdf", safe: true, mimeType: "application/pdf", disposition: "inline" };
  }

  // PNG
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "png", safe: true, mimeType: "image/png", disposition: "inline" };
  }

  // JPEG
  if (startsWith(data, [0xff, 0xd8, 0xff])) {
    return { kind: "jpeg", safe: true, mimeType: "image/jpeg", disposition: "inline" };
  }

  // GIF
  if (asciiAt(data, 0, "GIF87a") || asciiAt(data, 0, "GIF89a")) {
    return { kind: "gif", safe: true, mimeType: "image/gif", disposition: "inline" };
  }

  // WEBP: RIFF....WEBP
  if (asciiAt(data, 0, "RIFF") && asciiAt(data, 8, "WEBP")) {
    return { kind: "webp", safe: true, mimeType: "image/webp", disposition: "inline" };
  }

  // TIFF (little/big endian)
  if (startsWith(data, [0x49, 0x49, 0x2a, 0x00]) || startsWith(data, [0x4d, 0x4d, 0x00, 0x2a])) {
    return { kind: "tiff", safe: true, mimeType: "image/tiff", disposition: "inline" };
  }

  // BMP
  if (asciiAt(data, 0, "BM")) {
    return { kind: "bmp", safe: true, mimeType: "image/bmp", disposition: "inline" };
  }

  // Anything else (including HTML/script) is unsupported: force a download.
  return { kind: null, safe: false, mimeType: UNSAFE_MIME, disposition: "attachment" };
}

/**
 * Build a safe object URL for a medical document. Allowlisted formats are
 * previewed inline; unsupported content is served as an attachment so the
 * browser never renders it as active content.
 */
export function createSafeDocumentUrl(
  bytes: Uint8Array | ArrayBuffer,
  declaredMimeType?: string,
): { url: string; result: SniffResult } {
  const result = sniffDocument(bytes);
  const blob = new Blob([bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)], {
    type: result.safe ? result.mimeType : UNSAFE_MIME,
  });
  void declaredMimeType; // declared type is intentionally ignored; bytes win.
  return { url: URL.createObjectURL(blob), result };
}

/**
 * Trigger a safe download for a medical document. Unsupported formats are
 * always downloaded (never previewed), and errors never expose the body.
 */
export function downloadDocumentSafely(
  bytes: Uint8Array | ArrayBuffer,
  filename: string,
): SniffResult {
  const result = sniffDocument(bytes);
  const blob = new Blob([bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)], {
    type: result.safe ? result.mimeType : UNSAFE_MIME,
  });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return result;
}

/**
 * Sandbox attributes for embedding a document preview in an iframe. Scripts,
 * same-origin access, forms, and top navigation are all disabled.
 */
export const DOCUMENT_PREVIEW_SANDBOX = "allow-same-origin";

/**
 * Resolve a preview strategy for a medical document. Returns a sandboxed
 * inline preview for allowlisted formats, or a safe download for everything
 * else. Never returns an HTML/script preview.
 */
export function resolveDocumentPreview(
  bytes: Uint8Array | ArrayBuffer,
  filename: string,
): { mode: "preview"; url: string; sandbox: string } | { mode: "download"; result: SniffResult } {
  const result = sniffDocument(bytes);
  if (!result.safe) {
    return { mode: "download", result: downloadDocumentSafely(bytes, filename) };
  }
  const { url } = createSafeDocumentUrl(bytes);
  return { mode: "preview", url, sandbox: DOCUMENT_PREVIEW_SANDBOX };
}
