export interface DownloadOptions {
  /** Fallback filename when the response has no usable Content-Disposition. */
  fallbackFilename?: string;
  /** Allowlist of permitted content types. Defaults to a safe document set. */
  allowedContentTypes?: string[];
  /** Optional signal to cancel the download. */
  signal?: AbortSignal;
}

/** Content types that are safe to persist as a browser download. */
export const DEFAULT_ALLOWED_CONTENT_TYPES: string[] = [
  "application/pdf",
  "application/octet-stream",
  "application/zip",
  "application/json",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
];

/**
 * Remove unsafe path separators and control characters from a filename so it
 * cannot escape the download directory or inject headers.
 */
export function sanitizeFilename(filename: string, fallback = "download"): string {
  if (!filename) {
    return fallback;
  }

  const cleaned = filename
    // Strip control characters (including CR/LF used for header injection).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    // Remove any path separators (both POSIX and Windows).
    .replace(/[\\/]+/g, "_")
    // Remove characters that are invalid on common filesystems.
    .replace(/[<>:"|?*]/g, "_")
    // Collapse whitespace and trim leading/trailing dots and spaces.
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "");

  return cleaned || fallback;
}

/**
 * Parse a Content-Disposition header and return a sanitized filename.
 * Supports both `filename="..."` and RFC 5987 `filename*=UTF-8''...` forms.
 */
export function filenameFromContentDisposition(
  header: string | null,
  fallback = "download",
): string {
  if (!header) {
    return fallback;
  }

  const extended = header.match(/filename\*\s*=\s*([^;]+)/i);
  if (extended) {
    const value = extended[1].trim().replace(/^UTF-8''/i, "");
    try {
      return sanitizeFilename(decodeURIComponent(value), fallback);
    } catch {
      return sanitizeFilename(value, fallback);
    }
  }

  const quoted = header.match(/filename\s*=\s*"([^"]*)"/i);
  if (quoted) {
    return sanitizeFilename(quoted[1], fallback);
  }

  const bare = header.match(/filename\s*=\s*([^;]+)/i);
  if (bare) {
    return sanitizeFilename(bare[1].trim(), fallback);
  }

  return fallback;
}

/** Normalize a content type by dropping parameters and lowercasing. */
export function normalizeContentType(contentType: string | null): string {
  if (!contentType) {
    return "";
  }
  return contentType.split(";")[0].trim().toLowerCase();
}

/**
 * Detect a JSON error payload that was returned with a 2xx status. Such
 * responses must be surfaced as errors rather than saved as documents.
 */
export function isJsonErrorPayload(
  contentType: string | null,
  body: string,
): boolean {
  const normalized = normalizeContentType(contentType);
  if (normalized !== "application/json" && !normalized.endsWith("+json")) {
    return false;
  }

  const trimmed = body.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      return Boolean(
        (parsed as Record<string, unknown>).error ||
          (parsed as Record<string, unknown>).errors ||
          (parsed as Record<string, unknown>).message,
      );
    }
  } catch {
    return false;
  }

  return false;
}

/** Error thrown when a download response fails validation. */
export class DownloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DownloadValidationError";
  }
}

/**
 * Validate a download response and trigger a browser download.
 *
 * - Enforces an allowlist of content types.
 * - Detects JSON error bodies returned with a 2xx status.
 * - Sanitizes the filename from Content-Disposition.
 * - Revokes the object URL on success, cancel, and failure.
 */
export async function downloadResponse(
  response: Response,
  options: DownloadOptions = {},
): Promise<void> {
  const {
    fallbackFilename = "download",
    allowedContentTypes = DEFAULT_ALLOWED_CONTENT_TYPES,
    signal,
  } = options;

  if (!response.ok) {
    throw new DownloadValidationError(
      `Download failed with status ${response.status}`,
    );
  }

  const contentType = normalizeContentType(
    response.headers.get("content-type"),
  );

  // JSON responses are treated as error payloads, never as documents.
  if (contentType === "application/json" || contentType.endsWith("+json")) {
    const text = await response.text();
    if (isJsonErrorPayload(contentType, text)) {
      let message = "Download failed";
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        message =
          (typeof parsed.error === "string" && parsed.error) ||
          (typeof parsed.message === "string" && parsed.message) ||
          message;
      } catch {
        // keep default message
      }
      throw new DownloadValidationError(message);
    }
    throw new DownloadValidationError(
      "Unexpected JSON response for download",
    );
  }

  if (contentType && !allowedContentTypes.includes(contentType)) {
    throw new DownloadValidationError(
      `Unsupported download content type: ${contentType}`,
    );
  }

  const filename = filenameFromContentDisposition(
    response.headers.get("content-disposition"),
    fallbackFilename,
  );

  // Stream the body into a Blob without duplicating it in memory.
  const blob = await response.blob();

  if (signal?.aborted) {
    throw new DownloadValidationError("Download cancelled");
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke on success, cancel, and failure.
    URL.revokeObjectURL(objectUrl);
  }
}
