/**
 * Transaction intent preservation for wallet network mismatch recovery.
 *
 * When a connected wallet is on the wrong Stellar network, we must not sign.
 * Instead we capture a *non-sensitive* description of what the user intended
 * to do, so that after the network is corrected we can re-simulate and resume
 * without the user rebuilding the transaction from scratch.
 *
 * This module is intentionally free of secrets: it never stores private keys,
 * signed XDR, or any credential material. Only the public intent is kept.
 */

export type StellarNetwork = "PUBLIC" | "TESTNET" | "FUTURENET" | "STANDALONE";

/**
 * A non-sensitive description of the transaction the user wanted to perform.
 * Contains only public inputs required to re-build and re-simulate.
 */
export interface TransactionIntent {
  /** Contract or account the call targets (public). */
  contractId: string;
  /** Method name being invoked. */
  method: string;
  /** Public, non-secret arguments for the call. */
  args: Record<string, unknown>;
  /** Network the intent was authored against. */
  network: StellarNetwork;
  /** Public key of the connected account (never a secret). */
  publicKey: string;
  /** Monotonic id used to detect stale simulation results. */
  simulationId: number;
  /** Timestamp (ms) the intent was captured. */
  createdAt: number;
}

/**
 * Result of a simulation, tagged with the network and simulation id it was
 * produced for so stale results can be discarded after a network switch.
 */
export interface SimulationResult {
  simulationId: number;
  network: StellarNetwork;
  success: boolean;
  error?: string;
}

/**
 * Mismatch state surfaced to the UI. `expected` is the network the app is
 * configured for; `actual` is the network the wallet is currently on.
 */
export interface NetworkMismatch {
  expected: StellarNetwork;
  actual: StellarNetwork;
  /** Human-readable, accessible summary for the mismatch banner. */
  message: string;
}

const STORAGE_KEY = "handsoff.wallet.transactionIntent";

/** Networks the app is able to sign on. */
const SUPPORTED_NETWORKS: readonly StellarNetwork[] = ["PUBLIC", "TESTNET"];

/**
 * Returns true when the wallet network is supported for signing. Signing must
 * be blocked whenever this returns false.
 */
export function isSupportedNetwork(network: StellarNetwork): boolean {
  return SUPPORTED_NETWORKS.includes(network);
}

/**
 * Detect a mismatch between the app's expected network and the wallet's actual
 * network. Returns null when they match and the network is supported.
 */
export function detectNetworkMismatch(
  expected: StellarNetwork,
  actual: StellarNetwork,
): NetworkMismatch | null {
  if (expected === actual && isSupportedNetwork(actual)) {
    return null;
  }

  const message = !isSupportedNetwork(actual)
    ? `Unsupported network. Expected ${expected}, wallet is on ${actual}. Switch to ${expected} to continue.`
    : `Network mismatch. Expected ${expected}, wallet is on ${actual}. Switch to ${expected} to continue.`;

  return { expected, actual, message };
}

/**
 * Build a non-sensitive transaction intent. Callers must pass only public
 * inputs; secrets are never accepted or stored here.
 */
export function createTransactionIntent(params: {
  contractId: string;
  method: string;
  args: Record<string, unknown>;
  network: StellarNetwork;
  publicKey: string;
  simulationId: number;
}): TransactionIntent {
  return {
    contractId: params.contractId,
    method: params.method,
    args: params.args,
    network: params.network,
    publicKey: params.publicKey,
    simulationId: params.simulationId,
    createdAt: Date.now(),
  };
}

/**
 * Persist the intent so it survives a network switch / page reload. Only the
 * non-sensitive intent is written; nothing secret is ever serialized.
 */
export function saveTransactionIntent(intent: TransactionIntent): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Storage may be unavailable (private mode); intent preservation is best-effort.
  }
}

/** Load a previously preserved intent, or null when none exists. */
export function loadTransactionIntent(): TransactionIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TransactionIntent;
  } catch {
    return null;
  }
}

/** Clear the preserved intent. Must be called on logout. */
export function clearTransactionIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Determine whether a simulation result is stale relative to the current
 * network and simulation id. Stale results must be discarded and re-simulated.
 */
export function isSimulationStale(
  result: SimulationResult | null,
  currentNetwork: StellarNetwork,
  currentSimulationId: number,
): boolean {
  if (!result) return true;
  return (
    result.network !== currentNetwork ||
    result.simulationId !== currentSimulationId
  );
}

/**
 * After the network is corrected, decide whether the preserved intent can be
 * resumed. Returns the intent to re-simulate, or null when it is unusable
 * (e.g. it was authored on a different network than the corrected one).
 */
export function resumeIntentAfterNetworkSwitch(
  intent: TransactionIntent | null,
  correctedNetwork: StellarNetwork,
): TransactionIntent | null {
  if (!intent) return null;
  if (!isSupportedNetwork(correctedNetwork)) return null;
  if (intent.network !== correctedNetwork) return null;
  return intent;
}
