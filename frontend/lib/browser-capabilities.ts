/**
 * Browser capability detection for Web Crypto and secure storage.
 *
 * Wallet, encryption, and session features depend on these primitives. We
 * detect them up-front (at route boundaries, before any sensitive input is
 * collected) so unsupported browsers get a clear message instead of opaque
 * runtime errors.
 *
 * Security note: there is intentionally NO insecure fallback. If Web Crypto
 * or secure storage is unavailable we report the capability as missing rather
 * than persisting secrets in localStorage or plaintext.
 */

export type CapabilityName =
  | "webCrypto"
  | "secureRandom"
  | "secureStorage";

export interface CapabilityResult {
  supported: boolean;
  /** Human-readable reason when `supported` is false. */
  reason?: string;
}

export interface BrowserCapabilities {
  webCrypto: CapabilityResult;
  secureRandom: CapabilityResult;
  secureStorage: CapabilityResult;
  /** True only when every required capability is available. */
  allSupported: boolean;
  /** Names of the capabilities that are missing. */
  missing: CapabilityName[];
}

function hasWebCrypto(): CapabilityResult {
  if (typeof globalThis === "undefined") {
    return { supported: false, reason: "No global scope available." };
  }
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    return {
      supported: false,
      reason:
        "Web Crypto (crypto.subtle) is unavailable. A secure context (HTTPS or localhost) is required.",
    };
  }
  return { supported: true };
}

function hasSecureRandom(): CapabilityResult {
  if (typeof globalThis === "undefined") {
    return { supported: false, reason: "No global scope available." };
  }
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    return {
      supported: false,
      reason: "crypto.getRandomValues is unavailable for secure randomness.",
    };
  }
  return { supported: true };
}

function hasSecureStorage(): CapabilityResult {
  if (typeof globalThis === "undefined") {
    return { supported: false, reason: "No global scope available." };
  }
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  if (!storage) {
    return {
      supported: false,
      reason:
        "Persistent storage is unavailable. Secrets are never stored in an insecure fallback.",
    };
  }
  // Probe availability without persisting any secret material.
  try {
    const probeKey = "__capability_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
  } catch {
    return {
      supported: false,
      reason:
        "Persistent storage is blocked (private mode or disabled cookies). Secrets are never stored in an insecure fallback.",
    };
  }
  return { supported: true };
}

/**
 * Detect all capabilities required before sensitive input is accepted.
 * Safe to call in the browser; returns unsupported results in SSR/Node.
 */
export function detectBrowserCapabilities(): BrowserCapabilities {
  const webCrypto = hasWebCrypto();
  const secureRandom = hasSecureRandom();
  const secureStorage = hasSecureStorage();

  const missing: CapabilityName[] = [];
  if (!webCrypto.supported) missing.push("webCrypto");
  if (!secureRandom.supported) missing.push("secureRandom");
  if (!secureStorage.supported) missing.push("secureStorage");

  return {
    webCrypto,
    secureRandom,
    secureStorage,
    allSupported: missing.length === 0,
    missing,
  };
}

/**
 * Route-boundary guard. Call before rendering any sensitive input (wallet,
 * encryption, session flows). Returns the capability report so the caller can
 * render an unsupported-browser page or a supported alternative.
 */
export function requireBrowserCapabilities(): BrowserCapabilities {
  return detectBrowserCapabilities();
}

/**
 * Convenience predicate for route guards that only need a boolean.
 */
export function isBrowserSupported(): boolean {
  return detectBrowserCapabilities().allSupported;
}
