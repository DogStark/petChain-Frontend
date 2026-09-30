import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Supported Stellar networks for this app. Keep in sync with the backend
 * configuration and the wallet kit network passphrase mapping.
 */
export const SUPPORTED_NETWORKS = ['PUBLIC', 'TESTNET'] as const;

export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];

/**
 * Non-sensitive transaction intent. This intentionally excludes any secret
 * material (private keys, signed XDR, auth tokens). It only captures enough
 * context to rebuild a transaction after the user corrects their network.
 */
export interface TransactionIntent {
  /** Logical operation, e.g. "create-record" or "transfer". */
  operation: string;
  /** Public parameters needed to re-simulate the transaction. */
  params: Record<string, unknown>;
  /** Network the intent was originally built for. */
  network: string;
  /** Timestamp (ms) the intent was captured. */
  createdAt: number;
}

/**
 * Minimal shape of the wallet context this hook depends on. Kept structural so
 * it works with the existing wallet provider without importing it directly.
 */
export interface WalletNetworkSource {
  /** Currently connected network, e.g. "PUBLIC" | "TESTNET" | "FUTURENET". */
  network?: string | null;
  /** Whether a wallet is currently connected. */
  isConnected?: boolean;
  /** Optional disconnect handler used to clear intent on logout. */
  disconnect?: () => void | Promise<void>;
}

/**
 * Result of a simulation. `network` records which network produced it so stale
 * results can be detected and invalidated after a network switch.
 */
export interface SimulationResult<T = unknown> {
  data: T;
  network: string;
  simulatedAt: number;
}

export interface UseWalletNetworkOptions {
  /** Expected network for the app. Defaults to "PUBLIC". */
  expectedNetwork?: SupportedNetwork;
  /** Wallet source providing the connected network. */
  wallet: WalletNetworkSource;
  /** Called when the network changes so callers can re-simulate. */
  onNetworkChange?: (network: string) => void;
}

const INTENT_STORAGE_KEY = 'wallet:transaction-intent';

function isSupported(network: string | null | undefined): network is SupportedNetwork {
  return !!network && (SUPPORTED_NETWORKS as readonly string[]).includes(network);
}

function readStoredIntent(): TransactionIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(INTENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TransactionIntent;
    if (!parsed || typeof parsed.operation !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredIntent(intent: TransactionIntent | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (intent) {
      window.sessionStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(intent));
    } else {
      window.sessionStorage.removeItem(INTENT_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable — intent stays in memory only */
  }
}

/**
 * Detects wallet network mismatches before signing, preserves a non-sensitive
 * transaction intent across a network switch, and invalidates stale simulation
 * results when the network changes.
 */
export function useWalletNetwork(options: UseWalletNetworkOptions) {
  const { expectedNetwork = 'PUBLIC', wallet, onNetworkChange } = options;
  const actualNetwork = wallet.network ?? null;

  const [intent, setIntentState] = useState<TransactionIntent | null>(() => readStoredIntent());
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const previousNetwork = useRef<string | null>(actualNetwork);

  const isConnected = !!wallet.isConnected;
  const isSupportedNetwork = isSupported(actualNetwork);
  const isMismatch = isConnected && actualNetwork !== expectedNetwork;

  // Invalidate stale simulation results whenever the network changes.
  useEffect(() => {
    if (previousNetwork.current !== actualNetwork) {
      previousNetwork.current = actualNetwork;
      setSimulation(null);
      if (actualNetwork) onNetworkChange?.(actualNetwork);
    }
  }, [actualNetwork, onNetworkChange]);

  // Clear the preserved intent on logout / disconnect.
  useEffect(() => {
    if (!isConnected) {
      setIntentState(null);
      writeStoredIntent(null);
      setSimulation(null);
    }
  }, [isConnected]);

  const setIntent = useCallback((next: Omit<TransactionIntent, 'createdAt'> | null) => {
    if (!next) {
      setIntentState(null);
      writeStoredIntent(null);
      return;
    }
    const stored: TransactionIntent = { ...next, createdAt: Date.now() };
    setIntentState(stored);
    writeStoredIntent(stored);
  }, []);

  const clearIntent = useCallback(() => setIntent(null), [setIntent]);

  /**
   * Guard that must be checked before signing. Returns a structured result so
   * callers can render an actionable, accessible mismatch state.
   */
  const canSign = useCallback((): { ok: true } | { ok: false; reason: 'disconnected' | 'unsupported' | 'mismatch'; expected: string; actual: string | null } => {
    if (!isConnected) {
      return { ok: false, reason: 'disconnected', expected: expectedNetwork, actual: actualNetwork };
    }
    if (!isSupportedNetwork) {
      return { ok: false, reason: 'unsupported', expected: expectedNetwork, actual: actualNetwork };
    }
    if (actualNetwork !== expectedNetwork) {
      return { ok: false, reason: 'mismatch', expected: expectedNetwork, actual: actualNetwork };
    }
    return { ok: true };
  }, [isConnected, isSupportedNetwork, actualNetwork, expectedNetwork]);

  /**
   * Records a simulation result tagged with the network that produced it.
   * Results from a different network are treated as stale and dropped.
   */
  const recordSimulation = useCallback(
    <T,>(data: T): SimulationResult<T> | null => {
      if (!actualNetwork || actualNetwork !== expectedNetwork) return null;
      const result: SimulationResult<T> = { data, network: actualNetwork, simulatedAt: Date.now() };
      setSimulation(result as SimulationResult);
      return result;
    },
    [actualNetwork, expectedNetwork],
  );

  const isSimulationStale = useMemo(() => {
    if (!simulation) return false;
    return simulation.network !== actualNetwork;
  }, [simulation, actualNetwork]);

  return {
    expectedNetwork,
    actualNetwork,
    isConnected,
    isSupportedNetwork,
    isMismatch,
    canSign,
    intent,
    setIntent,
    clearIntent,
    simulation,
    recordSimulation,
    isSimulationStale,
  };
}

export default useWalletNetwork;
