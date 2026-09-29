/**
 * Browser support and feature-detection matrix.
 *
 * Supported browsers (latest two stable releases unless noted):
 * - Chrome / Edge (Chromium) 100+
 * - Firefox 100+
 * - Safari 15.4+ (iOS Safari 15.4+)
 * - Chrome for Android 100+
 *
 * Degraded behavior when a capability is unavailable:
 * - camera: capture actions are disabled and the user is told to use a
 *   supported browser or upload a file instead.
 * - webcrypto: secure key operations are disabled; no plaintext fallback is
 *   offered because that would weaken security guarantees.
 * - serviceWorker: offline caching and background sync are disabled; the app
 *   continues to work online only.
 * - wallet: wallet connection is disabled and the user is guided to install a
 *   supported wallet provider.
 * - fileApi: file uploads are disabled and the user is guided to a supported
 *   browser.
 *
 * All detection is guarded so that no browser API is touched during SSR.
 */

export type FeatureKey =
  | "camera"
  | "webcrypto"
  | "serviceWorker"
  | "wallet"
  | "fileApi";

export interface FeatureSupport {
  supported: boolean;
  /** Human-readable guidance shown when the feature is unavailable. */
  guidance: string;
}

export type FeatureMatrix = Record<FeatureKey, FeatureSupport>;

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof navigator !== "undefined";

const GUIDANCE: Record<FeatureKey, string> = {
  camera:
    "Camera capture is not available in this browser. Use a supported browser or upload a file instead.",
  webcrypto:
    "Secure key operations require WebCrypto, which this browser does not support. Please use a supported browser.",
  serviceWorker:
    "Offline mode is unavailable because service workers are not supported. The app will work online only.",
  wallet:
    "No supported wallet provider was detected. Install a supported wallet to connect.",
  fileApi:
    "File uploads are not supported in this browser. Please use a supported browser.",
};

function detectCamera(): boolean {
  if (!isBrowser()) return false;
  return (
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

function detectWebCrypto(): boolean {
  if (!isBrowser()) return false;
  return (
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.subtle !== "undefined"
  );
}

function detectServiceWorker(): boolean {
  if (!isBrowser()) return false;
  return "serviceWorker" in navigator;
}

function detectWallet(): boolean {
  if (!isBrowser()) return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof w.ethereum !== "undefined" || typeof w.solana !== "undefined";
}

function detectFileApi(): boolean {
  if (!isBrowser()) return false;
  return (
    typeof window.File !== "undefined" &&
    typeof window.FileReader !== "undefined" &&
    typeof window.Blob !== "undefined"
  );
}

const DETECTORS: Record<FeatureKey, () => boolean> = {
  camera: detectCamera,
  webcrypto: detectWebCrypto,
  serviceWorker: detectServiceWorker,
  wallet: detectWallet,
  fileApi: detectFileApi,
};

/**
 * Detect support for a single feature. Safe to call during SSR: returns
 * `supported: false` without touching any browser API.
 */
export function detectFeature(key: FeatureKey): FeatureSupport {
  const supported = isBrowser() ? DETECTORS[key]() : false;
  return { supported, guidance: GUIDANCE[key] };
}

/**
 * Detect the full feature matrix. Safe to call during SSR: every entry is
 * reported as unsupported with guidance, and no browser API is invoked.
 */
export function detectFeatures(): FeatureMatrix {
  return {
    camera: detectFeature("camera"),
    webcrypto: detectFeature("webcrypto"),
    serviceWorker: detectFeature("serviceWorker"),
    wallet: detectFeature("wallet"),
    fileApi: detectFeature("fileApi"),
  };
}

/**
 * Gate an action behind a feature check. Returns the support result so callers
 * can render guidance instead of invoking an unavailable API.
 */
export function gateFeature(
  key: FeatureKey,
  action: () => void,
): FeatureSupport {
  const support = detectFeature(key);
  if (support.supported) {
    action();
  }
  return support;
}
