'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Wallet network mismatch recovery.
 *
 * Detects when the connected wallet is on a different Stellar network than the
 * app expects, blocks signing, shows an actionable + accessible mismatch state,
 * preserves a non-sensitive transaction intent across the switch, and
 * invalidates stale simulation results once the network is corrected.
 */

export type StellarNetwork = 'PUBLIC' | 'TESTNET' | 'FUTURENET' | 'STANDALONE';

/** Non-sensitive description of what the user was trying to do. */
export interface TransactionIntent {
  /** Human readable action, e.g. "Create medical record". */
  action: string;
  /** Optional non-sensitive parameters (ids, amounts). Never secrets. */
  params?: Record<string, string | number>;
}

const INTENT_STORAGE_KEY = 'wallet:tx-intent';

/** Keys that must never be persisted as part of a transaction intent. */
const SENSITIVE_KEY_PATTERN = /(secret|seed|mnemonic|private|passphrase|password|token|key)/i;

/** Strip anything sensitive before persisting an intent. */
export function sanitizeIntent(intent: TransactionIntent): TransactionIntent {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(intent.params ?? {})) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    params[key] = value;
  }
  return { action: intent.action, params };
}

export function saveTransactionIntent(intent: TransactionIntent): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(sanitizeIntent(intent)));
  } catch {
    /* storage unavailable — intent preservation is best effort */
  }
}

export function loadTransactionIntent(): TransactionIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(INTENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TransactionIntent) : null;
  } catch {
    return null;
  }
}

/** Cleared on logout so no intent survives the session. */
export function clearTransactionIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(INTENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Guard used before signing. Returns true only when the wallet network matches
 * the expected network, so no transaction is ever signed on an unsupported one.
 */
export function canSignOnNetwork(
  expected: StellarNetwork,
  actual: StellarNetwork | null | undefined,
): boolean {
  return actual != null && actual === expected;
}

export interface NetworkMismatchBannerProps {
  /** Network the app expects transactions to be signed on. */
  expectedNetwork: StellarNetwork;
  /** Network the connected wallet currently reports. */
  actualNetwork: StellarNetwork | null;
  /** Called when the user asks to switch the wallet to the expected network. */
  onSwitchNetwork?: (target: StellarNetwork) => void | Promise<void>;
  /** Called after the network is corrected so callers can re-simulate. */
  onNetworkCorrected?: () => void;
  /** Optional intent to preserve across the switch. */
  intent?: TransactionIntent;
}

export default function NetworkMismatchBanner({
  expectedNetwork,
  actualNetwork,
  onSwitchNetwork,
  onNetworkCorrected,
  intent,
}: NetworkMismatchBannerProps) {
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preservedIntent, setPreservedIntent] = useState<TransactionIntent | null>(null);

  const mismatch = !canSignOnNetwork(expectedNetwork, actualNetwork);

  // Preserve a non-sensitive intent while the mismatch is active.
  useEffect(() => {
    if (!mismatch) return;
    const next = intent ?? loadTransactionIntent();
    if (next) {
      saveTransactionIntent(next);
      setPreservedIntent(sanitizeIntent(next));
    }
  }, [mismatch, intent]);

  // Once the network is corrected, invalidate stale simulation results and
  // hand control back to the caller to re-simulate.
  useEffect(() => {
    if (mismatch) return;
    if (preservedIntent) {
      onNetworkCorrected?.();
      setPreservedIntent(null);
    }
  }, [mismatch, preservedIntent, onNetworkCorrected]);

  const handleSwitch = useCallback(async () => {
    if (!onSwitchNetwork) return;
    setSwitching(true);
    setError(null);
    try {
      await onSwitchNetwork(expectedNetwork);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch network.');
    } finally {
      setSwitching(false);
    }
  }, [onSwitchNetwork, expectedNetwork]);

  const description = useMemo(() => {
    const actual = actualNetwork ?? 'unknown';
    return `Your wallet is connected to ${actual}, but this app requires ${expectedNetwork}.`;
  }, [actualNetwork, expectedNetwork]);

  if (!mismatch) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <h2 className="text-sm font-semibold">Wrong wallet network</h2>
      <p className="mt-1 text-sm">{description}</p>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 text-sm">
        <dt className="font-medium">Expected network</dt>
        <dd>{expectedNetwork}</dd>
        <dt className="font-medium">Actual network</dt>
        <dd>{actualNetwork ?? 'Unknown'}</dd>
      </dl>

      {preservedIntent ? (
        <p className="mt-2 text-sm">
          Your pending action &ldquo;{preservedIntent.action}&rdquo; will be kept while you switch
          networks.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSwitch}
        disabled={switching || !onSwitchNetwork}
        aria-busy={switching}
        className="mt-3 inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {switching ? 'Switching\u2026' : `Switch to ${expectedNetwork}`}
      </button>
    </div>
  );
}
