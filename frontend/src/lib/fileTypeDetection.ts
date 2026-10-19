/**
 * Content sniffing guard for medical document previews.
 *
 * A response with a misleading content type must never be rendered as active
 * HTML/script inside an authenticated page. We validate the actual bytes
 * (magic numbers) against an allowlist of safe, previewable document formats
 * before allowing an inline preview. Anything else falls back to a safe
 * download disposition.
 */

export type PreviewDisposition = 'inline' | 'attachment';

export interface SniffResult {
  /** Detected MIME type based on magic bytes, or null when unrecognized. */
  detectedType: string | null;
  /** Whether the content is safe to render inline in a sandboxed preview. */
  previewable: boolean;
  /** Safe disposition to use when serving the document. */
  disposition: PreviewDisposition;
}

interface MagicSignature {
  mime: string;
  bytes: number[];
  offset?: number;
}

/**
 * Allowlisted, non-executable document formats that are safe to preview.
 * HTML, SVG, XML and script-bearing formats are intentionally excluded.
 */
const MAGIC_SIGNATURES: MagicSignature[] = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WEBP
  { mime: 'image/bmp', bytes: [0x42, 0x4d] }, // BM
  { mime: 'image/tiff', bytes: [0x49, 0x49, 0x2a, 0x00] },
  { mime: 'image/tiff', bytes: [0x4d, 0x4d, 0x00, 0x2a] },
];

/** Formats that are explicitly never previewable, even if bytes look textual. */
const DANGEROUS_MIME_PATTERNS = [
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/xml',
  'text/xml',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
];

function matchesSignature(bytes: Uint8Array, signature: MagicSignature): boolean {
  const offset = signature.offset ?? 0;
  if (bytes.length < offset + signature.bytes.length) {
    return false;
  }
  for (let i = 0; i < signature.bytes.length; i += 1) {
    if (bytes[offset + i] !== signature.bytes[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Detect the MIME type from the leading bytes of a document.
 * Returns null when no allowlisted signature matches.
 */
export function detectMimeFromBytes(bytes: Uint8Array | ArrayBuffer): string | null {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const signature of MAGIC_SIGNATURES) {
    if (matchesSignature(view, signature)) {
      return signature.mime;
    }
  }
  return null;
}

/**
 * Sniff document content and decide whether it may be previewed inline.
 *
 * The declared content type is treated as untrusted: only content whose magic
 * bytes match an allowlisted, non-executable format is previewable. Everything
 * else (including HTML/script masquerading as a document) is served as a safe
 * attachment download.
 */
export function sniffDocument(
  bytes: Uint8Array | ArrayBuffer,
  declaredType?: string | null,
): SniffResult {
  const normalizedDeclared = (declaredType ?? '').split(';')[0].trim().toLowerCase();

  // Never trust a declared type that is inherently active/executable.
  if (DANGEROUS_MIME_PATTERNS.includes(normalizedDeclared)) {
    return { detectedType: null, previewable: false, disposition: 'attachment' };
  }

  const detectedType = detectMimeFromBytes(bytes);
  if (!detectedType) {
    return { detectedType: null, previewable: false, disposition: 'attachment' };
  }

  return { detectedType, previewable: true, disposition: 'inline' };
}

/**
 * Build a safe Content-Disposition value for a document response.
 * Unsupported formats are forced to `attachment` so the browser downloads
 * rather than renders them.
 */
export function buildContentDisposition(
  disposition: PreviewDisposition,
  filename: string,
): string {
  const safeName = filename.replace(/[\r\n"]/g, '_');
  return `${disposition}; filename="${safeName}"`;
}

/**
 * Attributes applied to a sandboxed preview container so that even a
 * misclassified document cannot execute scripts or navigate the top frame.
 */
export const SANDBOXED_PREVIEW_ATTRIBUTES = {
  sandbox: '',
  referrerPolicy: 'no-referrer' as const,
};
