/**
 * Emergency QR payload utilities.
 *
 * QR payloads are generated from a canonical, versioned schema that embeds
 * integrity data (a checksum over the canonical body). Before a QR is offered
 * for download/print the UI must verify a decode round-trip and reject
 * revoked, expired, or oversized payloads with actionable errors.
 */

export const QR_PAYLOAD_VERSION = 1 as const;

/** Maximum serialized payload size (bytes) allowed in a QR code. */
export const MAX_QR_PAYLOAD_BYTES = 2048;

/** Default lifetime for an emergency QR payload. */
export const DEFAULT_QR_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type QrPayloadStatus = "active" | "revoked" | "expired";

export interface EmergencyProfile {
  /** Stable identifier for the emergency profile. */
  profileId: string;
  /** Human-readable display name. */
  displayName: string;
  /** Optional emergency contact phone number. */
  emergencyContact?: string;
  /** Optional free-form medical notes. */
  notes?: string;
}

export interface QrPayloadInput {
  profile: EmergencyProfile;
  /** Issued-at timestamp (ms since epoch). Defaults to now. */
  issuedAt?: number;
  /** Expiry timestamp (ms since epoch). Defaults to issuedAt + TTL. */
  expiresAt?: number;
  /** Revocation flag; revoked payloads must never be rendered. */
  revoked?: boolean;
}

/** Canonical, versioned QR payload with integrity data. */
export interface QrPayload {
  version: typeof QR_PAYLOAD_VERSION;
  profileId: string;
  displayName: string;
  emergencyContact?: string;
  notes?: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  /** Integrity checksum over the canonical body. */
  checksum: string;
}

export type QrPayloadErrorCode =
  | "revoked"
  | "expired"
  | "oversized"
  | "invalid"
  | "checksum_mismatch"
  | "round_trip_failed";

export class QrPayloadError extends Error {
  readonly code: QrPayloadErrorCode;

  constructor(code: QrPayloadErrorCode, message: string) {
    super(message);
    this.name = "QrPayloadError";
    this.code = code;
  }
}

/**
 * Deterministic stringify with sorted keys so the checksum is stable across
 * environments and key insertion order.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`)
    .join(",")}}`;
}

/**
 * FNV-1a 32-bit hash rendered as an 8-char hex string. Small, dependency-free
 * integrity check suitable for detecting truncation/corruption in QR payloads.
 */
export function computeChecksum(body: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    hash ^= body.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function bodyOf(payload: Omit<QrPayload, "checksum">): string {
  return canonicalStringify(payload);
}

/**
 * Build a canonical, versioned QR payload with integrity data.
 * Throws QrPayloadError for revoked/expired/oversized inputs.
 */
export function buildQrPayload(input: QrPayloadInput): QrPayload {
  const issuedAt = input.issuedAt ?? Date.now();
  const expiresAt = input.expiresAt ?? issuedAt + DEFAULT_QR_TTL_MS;
  const revoked = input.revoked ?? false;

  const body: Omit<QrPayload, "checksum"> = {
    version: QR_PAYLOAD_VERSION,
    profileId: input.profile.profileId,
    displayName: input.profile.displayName,
    emergencyContact: input.profile.emergencyContact,
    notes: input.profile.notes,
    issuedAt,
    expiresAt,
    revoked,
  };

  const payload: QrPayload = { ...body, checksum: computeChecksum(bodyOf(body)) };

  assertRenderable(payload);
  return payload;
}

/** Serialize a payload to the canonical string encoded into the QR. */
export function serializeQrPayload(payload: QrPayload): string {
  return JSON.stringify(payload);
}

/**
 * Parse and validate a serialized payload, verifying version, checksum, and
 * renderability. Throws QrPayloadError on any failure.
 */
export function parseQrPayload(serialized: string): QrPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new QrPayloadError("invalid", "QR payload is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new QrPayloadError("invalid", "QR payload is malformed.");
  }

  const candidate = parsed as Partial<QrPayload>;
  if (candidate.version !== QR_PAYLOAD_VERSION) {
    throw new QrPayloadError(
      "invalid",
      `Unsupported QR payload version: ${String(candidate.version)}.`,
    );
  }
  if (typeof candidate.checksum !== "string") {
    throw new QrPayloadError("invalid", "QR payload is missing integrity data.");
  }

  const { checksum, ...body } = candidate as QrPayload;
  const expected = computeChecksum(bodyOf(body));
  if (expected !== checksum) {
    throw new QrPayloadError(
      "checksum_mismatch",
      "QR payload failed integrity check; it may be truncated or corrupted.",
    );
  }

  const payload = { ...body, checksum } as QrPayload;
  assertRenderable(payload);
  return payload;
}

/**
 * Verify a decode round-trip: serialize, re-parse, and confirm the payload is
 * byte-for-byte equivalent before the QR is offered for download/print.
 */
export function verifyDecodeRoundTrip(payload: QrPayload): QrPayload {
  const serialized = serializeQrPayload(payload);
  let decoded: QrPayload;
  try {
    decoded = parseQrPayload(serialized);
  } catch (err) {
    if (err instanceof QrPayloadError) throw err;
    throw new QrPayloadError(
      "round_trip_failed",
      "QR payload failed decode round-trip verification.",
    );
  }
  if (serializeQrPayload(decoded) !== serialized) {
    throw new QrPayloadError(
      "round_trip_failed",
      "QR payload changed during decode round-trip verification.",
    );
  }
  return decoded;
}

/**
 * Assert a payload is safe to render. Blocks revoked, expired, and oversized
 * payloads with actionable error messages.
 */
export function assertRenderable(payload: QrPayload, now: number = Date.now()): void {
  if (payload.revoked) {
    throw new QrPayloadError(
      "revoked",
      "This emergency QR has been revoked. Generate a new QR from the current profile.",
    );
  }
  if (typeof payload.expiresAt === "number" && payload.expiresAt <= now) {
    throw new QrPayloadError(
      "expired",
      "This emergency QR has expired. Regenerate it to restore access.",
    );
  }
  const size = byteLength(serializeQrPayload(payload));
  if (size > MAX_QR_PAYLOAD_BYTES) {
    throw new QrPayloadError(
      "oversized",
      `Emergency QR payload is ${size} bytes, exceeding the ${MAX_QR_PAYLOAD_BYTES}-byte limit. Shorten the profile notes and try again.`,
    );
  }
}

/** UTF-8 byte length of a string without relying on Node/Buffer globals. */
export function byteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // Surrogate pair.
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Prepare a payload for rendering: build, verify the decode round-trip, and
 * return the canonical serialized string. Throws QrPayloadError on failure so
 * the UI can block download/print and surface an actionable message.
 */
export function prepareQrPayload(input: QrPayloadInput): {
  payload: QrPayload;
  serialized: string;
} {
  const payload = buildQrPayload(input);
  const verified = verifyDecodeRoundTrip(payload);
  return { payload: verified, serialized: serializeQrPayload(verified) };
}
