import React from 'react';

export type CapabilityName =
  | 'webCrypto'
  | 'secureRandom'
  | 'secureStorage';

export interface CapabilityReport {
  webCrypto: boolean;
  secureRandom: boolean;
  secureStorage: boolean;
  supported: boolean;
  missing: CapabilityName[];
}

const CAPABILITY_LABELS: Record<CapabilityName, string> = {
  webCrypto: 'Web Crypto (SubtleCrypto)',
  secureRandom: 'Cryptographically secure random values',
  secureStorage: 'Secure browser storage',
};

/**
 * Detects the browser capabilities required before any sensitive input
 * (wallet keys, encryption, session secrets) is accepted.
 *
 * This is intentionally side-effect free and never falls back to an
 * insecure store: if a capability is missing it is reported as missing
 * so the caller can block the route instead of persisting secrets.
 */
export function detectCapabilities(): CapabilityReport {
  const missing: CapabilityName[] = [];

  const webCrypto =
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined' &&
    typeof globalThis.crypto.subtle.generateKey === 'function';
  if (!webCrypto) {
    missing.push('webCrypto');
  }

  const secureRandom =
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function';
  if (!secureRandom) {
    missing.push('secureRandom');
  }

  const secureStorage = hasSecureStorage();
  if (!secureStorage) {
    missing.push('secureStorage');
  }

  return {
    webCrypto,
    secureRandom,
    secureStorage,
    supported: missing.length === 0,
    missing,
  };
}

/**
 * Secure storage is only considered available when the browser exposes
 * the Web Crypto API needed to protect stored secrets. We deliberately
 * do NOT fall back to localStorage/plaintext, which would persist
 * secrets insecurely.
 */
function hasSecureStorage(): boolean {
  if (typeof globalThis === 'undefined') {
    return false;
  }
  const cryptoAvailable =
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined';
  if (!cryptoAvailable) {
    return false;
  }
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return false;
    }
    const probeKey = '__capability_probe__';
    globalThis.localStorage.setItem(probeKey, '1');
    globalThis.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

export interface UnsupportedBrowserNoticeProps {
  report?: CapabilityReport;
  onRetry?: () => void;
}

/**
 * Clear unsupported-browser page shown at route boundaries when required
 * capabilities are missing, before any sensitive input is collected.
 */
export default function UnsupportedBrowserNotice({
  report,
  onRetry,
}: UnsupportedBrowserNoticeProps) {
  const capabilities = report ?? detectCapabilities();
  const missing = capabilities.missing;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="unsupported-browser-notice"
      style={{
        maxWidth: 560,
        margin: '4rem auto',
        padding: '2rem',
        border: '1px solid #e0b4b4',
        borderRadius: 8,
        background: '#fff5f5',
        color: '#3d1a1a',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ marginTop: 0, fontSize: '1.25rem' }}>
        Your browser is not supported
      </h1>
      <p>
        This feature requires secure browser capabilities that are not
        available in your current browser. To protect your secrets, we have
        stopped before collecting any sensitive information.
      </p>
      {missing.length > 0 && (
        <>
          <p style={{ marginBottom: '0.5rem' }}>Missing capabilities:</p>
          <ul data-testid="missing-capabilities">
            {missing.map((name) => (
              <li key={name}>{CAPABILITY_LABELS[name]}</li>
            ))}
          </ul>
        </>
      )}
      <p>
        Please use a recent version of Chrome, Firefox, Edge, or Safari over a
        secure (HTTPS) connection, then reload this page.
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
