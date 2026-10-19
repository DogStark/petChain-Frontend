/**
 * Wallet network mismatch recovery with transaction intent preservation.
 *
 * Detects when a connected wallet is on the wrong Stellar network before
 * signing, exposes an actionable/accessible mismatch state, preserves a
 * non-sensitive transaction intent across a network switch, and invalidates
 * stale simulation results when the network changes.
 */

export const STELLAR_NETWORKS = {
  PUBLIC: "PUBLIC",
  TESTNET: "TESTNET",
  FUTURENET: "FUTURENET",
} as const;

export type StellarNetwork = (typeof STELLAR_NETWORKS)[keyof typeof STELLAR_NETWORKS];

const SUPPORTED_NETWORKS: readonly StellarNetwork[] = [
  STELLAR_NETWORKS.PUBLIC,
  STELLAR_NETWORKS.TESTNET,
  STELLAR_NETWORKS.FUTURENET,
];

const NETWORK_PASSPHRASES: Record<StellarNetwork, string> = {
  PUBLIC: "Public Global Stellar Network ; September 2015",
  TESTNET: "Test SDF Network ; September 2015",
  FUTURENET: "Test SDF Future Network ; October 2022",
};

/**
 * Non-sensitive transaction intent. Never contains secrets, private keys,
 * signed XDR, or any credential material.
 */
export interface TransactionIntent {
  /** Destination account (public key). */
  destination: string;
  /** Amount as a decimal string to avoid float precision loss. */
  amount: string;
  /** Asset code, e.g. "XLM" or an issued asset code. */
  assetCode: string;
  /** Optional asset issuer (public key) for issued assets. */
  assetIssuer?: string;
  /** Optional memo text. */
  memo?: string;
}

/**
 * Simulation result tied to a specific network. The `network` field lets
 * consumers detect and discard stale results after a network switch.
 */
export interface SimulationResult {
  network: StellarNetwork;
  /** Opaque, non-sensitive simulation payload. */
  data: unknown;
  /** Timestamp (ms) the simulation was produced. */
  simulatedAt: number;
}

export interface NetworkMismatchState {
  /** Whether the wallet network differs from the expected network. */
  mismatch: boolean;
  /** The network the app expects to operate on. */
  expected: StellarNetwork;
  /** The network the wallet is currently connected to. */
  actual: StellarNetwork | null;
  /** Whether the actual network is supported at all. */
  supported: boolean;
  /** Human-readable, accessible message describing the state. */
  message: string;
}

export function isSupportedNetwork(network: string | null | undefined): network is StellarNetwork {
  return !!network && (SUPPORTED_NETWORKS as readonly string[]).includes(network);
}

export function getNetworkPassphrase(network: StellarNetwork): string {
  return NETWORK_PASSPHRASES[network];
}

/**
 * Compute the mismatch state between the expected and actual wallet network.
 * This is the single source of truth used to block signing.
 */
export function getNetworkMismatchState(
  expected: StellarNetwork,
  actual: string | null | undefined,
): NetworkMismatchState {
  const supported = isSupportedNetwork(actual);
  const mismatch = !supported || actual !== expected;

  let message: string;
  if (!actual) {
    message = `No wallet network detected. Connect a wallet on the ${expected} network to continue.`;
  } else if (!supported) {
    message = `Unsupported wallet network "${actual}". Switch your wallet to the ${expected} network to continue.`;
  } else if (mismatch) {
    message = `Wallet is on the ${actual} network but this app expects ${expected}. Switch networks to continue.`;
  } else {
    message = `Wallet is on the expected ${expected} network.`;
  }

  return {
    mismatch,
    expected,
    actual: supported ? (actual as StellarNetwork) : null,
    supported,
    message,
  };
}

/**
 * Guard that must be checked before signing. Returns true only when the
 * wallet is on a supported network that matches the expected network.
 */
export function canSignOnNetwork(
  expected: StellarNetwork,
  actual: string | null | undefined,
): boolean {
  return !getNetworkMismatchState(expected, actual).mismatch;
}

/**
 * In-memory store for the non-sensitive transaction intent. Kept outside of
 * component state so it survives a network switch (which typically remounts
 * wallet providers) and can be explicitly cleared on logout.
 */
let preservedIntent: TransactionIntent | null = null;

export function preserveTransactionIntent(intent: TransactionIntent): void {
  preservedIntent = { ...intent };
}

export function getPreservedTransactionIntent(): TransactionIntent | null {
  return preservedIntent ? { ...preservedIntent } : null;
}

export function clearTransactionIntent(): void {
  preservedIntent = null;
}

/**
 * Clear all wallet-scoped state. Call on logout so no intent or simulation
 * data leaks across sessions.
 */
export function clearWalletState(): void {
  preservedIntent = null;
}

/**
 * Returns true when a simulation result is stale relative to the current
 * network and must be discarded (e.g. after a network switch).
 */
export function isSimulationStale(
  result: SimulationResult | null | undefined,
  currentNetwork: StellarNetwork,
): boolean {
  if (!result) return true;
  return result.network !== currentNetwork;
}

/**
 * Invalidate a simulation result if it no longer matches the current network.
 * Returns null when stale so callers can re-simulate.
 */
export function invalidateStaleSimulation(
  result: SimulationResult | null | undefined,
  currentNetwork: StellarNetwork,
): SimulationResult | null {
  return isSimulationStale(result, currentNetwork) ? null : result;
}
