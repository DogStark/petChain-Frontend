export type QrPermissionState =
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

export interface QrValidationResult {
  ok: boolean;
  code?: string;
  error?: string;
}

const ALLOWED_ORIGINS = [
  "https://app.example.com",
  "https://example.com",
];

const CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}

function extractCodeFromUrl(raw: string): QrValidationResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "This QR code is not a valid link." };
  }

  if (!isAllowedOrigin(url.origin)) {
    return { ok: false, error: "This QR code comes from an untrusted source." };
  }

  const code = url.searchParams.get("code") ?? "";
  if (!CODE_PATTERN.test(code)) {
    return { ok: false, error: "This QR code is missing a valid code." };
  }

  return { ok: true, code };
}

/**
 * Validate a raw QR payload (URL or manual code) using a single shared path.
 * Both camera scans and manual entry funnel through here so error messages
 * and acceptance rules stay identical.
 */
export function validateQrPayload(raw: string): QrValidationResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a code or scan a QR code." };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return extractCodeFromUrl(trimmed);
  }

  if (!CODE_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: "Codes are 4-32 letters and numbers.",
    };
  }

  return { ok: true, code: trimmed };
}

/**
 * Browser-specific recovery guidance for a denied camera permission.
 */
export function getPermissionRecoveryGuidance(): string {
  if (typeof navigator === "undefined") {
    return "Enable camera access in your browser settings, then reload the page.";
  }

  const ua = navigator.userAgent;

  if (/Firefox\//i.test(ua)) {
    return "In Firefox, open the lock icon in the address bar, clear the camera block, then reload.";
  }

  if (/Edg\//i.test(ua)) {
    return "In Edge, open Settings > Cookies and site permissions > Camera and allow this site, then reload.";
  }

  if (/Chrome\//i.test(ua)) {
    return "In Chrome, click the camera icon in the address bar, choose Allow, then reload.";
  }

  if (/Safari\//i.test(ua)) {
    return "In Safari, open Settings > Websites > Camera and allow this site, then reload.";
  }

  return "Enable camera access in your browser settings, then reload the page.";
}

/**
 * Resolve the current permission state from the browser APIs.
 */
export function getPermissionState(): QrPermissionState {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    return "unsupported";
  }
  return "granted";
}

/**
 * Stop every track on a media stream. Safe to call with null/undefined.
 */
export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

/**
 * Create a debouncer that suppresses duplicate payloads within a window.
 * One payload produces one navigation.
 */
export function createDuplicateGuard(windowMs = 2000) {
  let lastPayload: string | null = null;
  let lastAt = 0;

  return function isDuplicate(payload: string): boolean {
    const now = Date.now();
    if (payload === lastPayload && now - lastAt < windowMs) {
      return true;
    }
    lastPayload = payload;
    lastAt = now;
    return false;
  };
}
