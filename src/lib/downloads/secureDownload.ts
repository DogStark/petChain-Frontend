/**
 * @file secureDownload.ts
 * Issue #965 — Protected download authorization checks.
 *
 * ## Problem
 * A download URL copied from a medical document or export flow can outlive
 * the UI authorization that created it.  Permanent storage credentials must
 * never be exposed in the browser, and the client must verify resource
 * ownership/context before requesting a download.
 *
 * ## This module provides
 * - `requestScopedToken` — obtains a short-lived, scoped download token from
 *   the API.  The token is scoped to a specific resource and owner and expires
 *   after `TOKEN_TTL_MS`.  The raw storage URL is never returned to the browser.
 * - `verifyOwnership` — checks that the requesting user owns the resource
 *   before a download token is requested.  Cross-account access is rejected.
 * - `downloadWithAuth` — orchestrates the full flow: verify ownership →
 *   request token → fetch the resource → trigger browser download.
 * - `handleExpiredLink` — recovery path presented to the user when a token has
 *   expired or been revoked.
 *
 * ## Security invariants
 * 1. No permanent storage credentials (S3 keys, signed-URL query params) are
 *    ever surfaced to the frontend.  The backend issues short-lived, scoped
 *    tokens; the browser sends the token as an Authorization header, not as a
 *    URL parameter.
 * 2. Ownership is verified client-side before the token request.  The backend
 *    also enforces ownership, so this is defence-in-depth.
 * 3. Token TTL is enforced both at creation and on use.  An expired token
 *    returns a `token_expired` failure that the UI can recover from gracefully.
 * 4. Revoked tokens surface a `token_revoked` failure with the same recovery
 *    path as expiry.
 * 5. Browser download interruptions (the user navigates away mid-download) are
 *    handled via an `AbortController`; the allocated blob URL is always revoked
 *    on completion, error, or abort.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Supported resource types that can be downloaded through this service. */
export type DownloadResourceType =
  | 'medical-record'
  | 'lab-result'
  | 'surgery-report'
  | 'pet-export'
  | 'dental-record';

export interface DownloadRequest {
  /** ID of the resource to download. */
  resourceId: string;
  /** Type of resource (determines the API endpoint used). */
  resourceType: DownloadResourceType;
  /** ID of the authenticated user requesting the download. */
  requestingUserId: string;
  /** Filename suggested to the browser's save dialog. */
  filename: string;
  /** Optional MIME type override. */
  mimeType?: string;
}

export interface ScopedDownloadToken {
  /** Opaque token string. */
  token: string;
  /** ISO timestamp when the token expires. */
  expiresAt: string;
  /** The resource this token grants access to. */
  resourceId: string;
  /** The user this token was issued to. */
  userId: string;
}

export type DownloadFailureReason =
  | 'ownership_denied'   // user does not own the resource
  | 'token_expired'      // token has expired; retry with a fresh one
  | 'token_revoked'      // token was explicitly revoked server-side
  | 'token_request_failed' // API error while requesting token
  | 'fetch_failed'       // HTTP error while fetching the resource
  | 'aborted'            // AbortSignal fired
  | 'network_error';     // no connectivity or CORS failure

export interface DownloadSuccess {
  ok: true;
  filename: string;
  byteSize: number;
}

export interface DownloadFailure {
  ok: false;
  reason: DownloadFailureReason;
  message: string;
  /** For token_expired or token_revoked: a user-visible recovery suggestion. */
  recovery?: string;
}

export type DownloadResult = DownloadSuccess | DownloadFailure;

/** HTTP client interface — injected so the service is testable. */
export interface DownloadHttpClient {
  /**
   * Request a short-lived download token from the API.
   * Throws on HTTP error.
   */
  requestToken(
    resourceId: string,
    resourceType: DownloadResourceType,
    userId: string,
    signal?: AbortSignal
  ): Promise<ScopedDownloadToken>;

  /**
   * Fetch the resource bytes using the scoped token.
   * The token is sent as `Authorization: Bearer <token>`.
   * Throws on HTTP error; the raw storage URL is resolved by the backend.
   */
  fetchResource(
    resourceId: string,
    resourceType: DownloadResourceType,
    token: string,
    signal?: AbortSignal
  ): Promise<Response>;

  /**
   * Verify that the given user owns the given resource.
   * Returns the owner user-id; throws with `403` status on denial.
   */
  verifyOwnership(
    resourceId: string,
    resourceType: DownloadResourceType,
    userId: string,
    signal?: AbortSignal
  ): Promise<{ ownerId: string }>;
}

// ─── Token expiry helpers ──────────────────────────────────────────────────────

/** Default token TTL: 5 minutes. */
export const TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * Returns `true` when the token has passed its `expiresAt` timestamp.
 * Adds a 10-second clock-skew buffer to account for slight server/client drift.
 */
export function isTokenExpired(token: ScopedDownloadToken, nowMs = Date.now()): boolean {
  const expiresMs = new Date(token.expiresAt).getTime();
  const SKEW_BUFFER_MS = 10_000;
  return nowMs >= expiresMs - SKEW_BUFFER_MS;
}

// ─── Recovery path ────────────────────────────────────────────────────────────

export interface ExpiredLinkRecovery {
  /** User-visible message. */
  message: string;
  /** Action the UI should offer to the user. */
  action: 'retry' | 'contact_support' | 're_authenticate';
}

/**
 * Produce a typed recovery suggestion when a link has expired or been revoked.
 *
 * Callers render this as an error banner with a "Try again" / "Contact support"
 * button rather than crashing or showing a bare HTTP status.
 */
export function handleExpiredLink(reason: 'token_expired' | 'token_revoked'): ExpiredLinkRecovery {
  if (reason === 'token_expired') {
    return {
      message:
        'This download link has expired. Download links are valid for 5 minutes. ' +
        'Please request a new download.',
      action: 'retry',
    };
  }

  return {
    message:
      'This download link has been revoked and can no longer be used. ' +
      'If you believe this is an error, please contact support.',
    action: 'contact_support',
  };
}

// ─── Ownership verification ───────────────────────────────────────────────────

/**
 * Client-side ownership check — defence-in-depth layer before token request.
 *
 * The backend enforces ownership authoritatively.  This pre-flight check lets
 * the UI surface a clear "Access Denied" message before any token is requested,
 * preventing unnecessary API round-trips for cross-account URLs.
 *
 * @returns `null` on success; a `DownloadFailure` if denied or the request failed.
 */
export async function verifyOwnership(
  request: DownloadRequest,
  client: DownloadHttpClient,
  signal?: AbortSignal
): Promise<DownloadFailure | null> {
  if (signal?.aborted) {
    return { ok: false, reason: 'aborted', message: 'Ownership check cancelled.' };
  }

  try {
    const { ownerId } = await client.verifyOwnership(
      request.resourceId,
      request.resourceType,
      request.requestingUserId,
      signal
    );

    if (ownerId !== request.requestingUserId) {
      return {
        ok: false,
        reason: 'ownership_denied',
        message:
          'You do not have permission to download this resource. ' +
          'Ensure you are logged in as the correct account.',
      };
    }

    return null; // ownership verified
  } catch (err: unknown) {
    if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      return { ok: false, reason: 'aborted', message: 'Ownership check cancelled.' };
    }

    const status = (err as { status?: number })?.status;
    if (status === 403) {
      return {
        ok: false,
        reason: 'ownership_denied',
        message: 'Access denied — this resource belongs to a different account.',
      };
    }

    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: 'token_request_failed',
      message: `Ownership check failed: ${msg}`,
    };
  }
}

// ─── Token request ────────────────────────────────────────────────────────────

/**
 * Request a short-lived, scoped download token from the backend.
 *
 * @returns The token on success, or a `DownloadFailure` on error.
 */
export async function requestScopedToken(
  request: DownloadRequest,
  client: DownloadHttpClient,
  signal?: AbortSignal
): Promise<ScopedDownloadToken | DownloadFailure> {
  if (signal?.aborted) {
    return { ok: false, reason: 'aborted', message: 'Token request cancelled.' };
  }

  try {
    const token = await client.requestToken(
      request.resourceId,
      request.resourceType,
      request.requestingUserId,
      signal
    );

    // Sanity check: backend should not issue an already-expired token
    if (isTokenExpired(token)) {
      return {
        ok: false,
        reason: 'token_expired',
        message: 'The server issued an already-expired token. Please try again.',
        recovery: handleExpiredLink('token_expired').message,
      };
    }

    return token;
  } catch (err: unknown) {
    if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      return { ok: false, reason: 'aborted', message: 'Token request cancelled.' };
    }

    const status = (err as { status?: number })?.status;
    const msg = err instanceof Error ? err.message : String(err);

    if (status === 401 || status === 403) {
      return { ok: false, reason: 'ownership_denied', message: msg };
    }

    return { ok: false, reason: 'token_request_failed', message: `Token request failed: ${msg}` };
  }
}

// ─── Browser download trigger ─────────────────────────────────────────────────

/**
 * Create a temporary anchor element and click it to trigger a browser
 * file-save dialog for the given `Blob`.
 *
 * The object URL is revoked synchronously after the click to prevent memory
 * leaks.  The anchor is removed from the DOM immediately.
 *
 * This function is side-effect only (no return value).
 * Isolated here so it can be mocked in tests without patching `document`.
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Always revoke, even if the click somehow throws
    URL.revokeObjectURL(url);
  }
}

// ─── Main orchestration ───────────────────────────────────────────────────────

/**
 * Full download flow:
 *  1. Verify ownership (client-side pre-flight).
 *  2. Request a short-lived, scoped token.
 *  3. Fetch the resource bytes with the token (never exposes the storage URL).
 *  4. Trigger the browser's file-save dialog.
 *
 * At every step, `AbortSignal` cancellation is respected so a browser
 * navigation or user cancel during a long download is handled cleanly.
 *
 * @param request     What to download and who is requesting it.
 * @param client      HTTP client (injected for testability).
 * @param signal      Optional `AbortSignal` for cancellation.
 * @param onProgress  Optional progress callback (0–100).
 */
export async function downloadWithAuth(
  request: DownloadRequest,
  client: DownloadHttpClient,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void
): Promise<DownloadResult> {
  // Step 1 — ownership verification
  const ownershipError = await verifyOwnership(request, client, signal);
  if (ownershipError) return ownershipError;

  if (signal?.aborted) {
    return { ok: false, reason: 'aborted', message: 'Download cancelled.' };
  }

  // Step 2 — request scoped token
  const tokenOrError = await requestScopedToken(request, client, signal);
  if ('ok' in tokenOrError && !tokenOrError.ok) return tokenOrError as DownloadFailure;

  const token = tokenOrError as ScopedDownloadToken;

  if (signal?.aborted) {
    return { ok: false, reason: 'aborted', message: 'Download cancelled after token acquisition.' };
  }

  // Step 3 — fetch resource bytes using the scoped token
  let response: Response;
  try {
    response = await client.fetchResource(
      request.resourceId,
      request.resourceType,
      token.token,
      signal
    );
  } catch (err: unknown) {
    if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      return { ok: false, reason: 'aborted', message: 'Download cancelled during fetch.' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'network_error', message: `Network error: ${msg}` };
  }

  if (!response.ok) {
    const status = response.status;

    if (status === 401 || status === 410) {
      const recovery = handleExpiredLink('token_expired');
      return {
        ok: false,
        reason: 'token_expired',
        message: `Download token expired (HTTP ${status}).`,
        recovery: recovery.message,
      };
    }

    if (status === 403) {
      const recovery = handleExpiredLink('token_revoked');
      return {
        ok: false,
        reason: 'token_revoked',
        message: `Download token revoked (HTTP 403).`,
        recovery: recovery.message,
      };
    }

    return {
      ok: false,
      reason: 'fetch_failed',
      message: `Failed to fetch resource (HTTP ${status}).`,
    };
  }

  // Step 4 — read the response body and trigger browser download
  let blob: Blob;
  try {
    // Stream the body with progress reporting when Content-Length is available
    const contentLength = response.headers.get('Content-Length');
    if (contentLength && onProgress && response.body) {
      const total = parseInt(contentLength, 10);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        if (signal?.aborted) {
          reader.cancel();
          return { ok: false, reason: 'aborted', message: 'Download cancelled during read.' };
        }
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        onProgress(Math.min(100, Math.round((received / total) * 100)));
      }

      blob = new Blob(chunks, { type: request.mimeType || 'application/octet-stream' });
    } else {
      blob = await response.blob();
    }
  } catch (err: unknown) {
    if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      return { ok: false, reason: 'aborted', message: 'Download cancelled during read.' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'fetch_failed', message: `Failed to read response: ${msg}` };
  }

  onProgress?.(100);
  triggerBrowserDownload(blob, request.filename);

  return { ok: true, filename: request.filename, byteSize: blob.size };
}
