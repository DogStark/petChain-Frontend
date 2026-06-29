import {
  isConnected as freighterIsConnected,
  requestAccess as freighterRequestAccess,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WalletProvider = 'freighter' | 'albedo';

export interface ConnectResult {
  isConnected: boolean;
}

export interface AccessResult {
  address: string;
  error?: string;
}

export interface SignResult {
  signedTxXdr: string;
  error?: string;
}

// ─── Provider detection ───────────────────────────────────────────────────────

/** Returns true if Freighter extension is available in the browser. */
export function isFreighterAvailable(): boolean {
  return !!(window as any).freighterApi || !!(window as any).freighter;
}

/** Returns true if Albedo is available (loaded via CDN or injected). */
export function isAlbedoAvailable(): boolean {
  return typeof (window as any).albedo?.publicKey === 'function';
}

/** Returns the list of wallet providers currently available in this browser. */
export function getAvailableProviders(): WalletProvider[] {
  const providers: WalletProvider[] = [];
  if (isFreighterAvailable()) providers.push('freighter');
  if (isAlbedoAvailable()) providers.push('albedo');
  return providers;
}

// ─── isConnected ─────────────────────────────────────────────────────────────

/**
 * Check whether any supported wallet is connected.
 * Tries Freighter first, then Albedo.
 */
export async function isConnected(provider?: WalletProvider): Promise<ConnectResult> {
  const target = provider ?? (isFreighterAvailable() ? 'freighter' : 'albedo');

  if (target === 'albedo') {
    // Albedo doesn't have a persistent connection concept — treat as always available
    return { isConnected: isAlbedoAvailable() };
  }

  // Freighter
  const freighterApi = (window as any).freighterApi;

  if (freighterApi?.isConnected && typeof freighterApi.isConnected === 'function') {
    try {
      const result = await freighterApi.isConnected();
      if (typeof result === 'boolean') return { isConnected: result };
      if (result && typeof result === 'object' && 'isConnected' in result) return result;
    } catch (e) {
      console.warn('[WalletBridge] freighterApi.isConnected error:', e);
    }
  }

  try {
    return await freighterIsConnected();
  } catch (e) {
    console.error('[WalletBridge] Library isConnected failed:', e);
    return { isConnected: !!(window as any).freighter };
  }
}

// ─── requestAccess ────────────────────────────────────────────────────────────

/**
 * Request wallet access and return the user's public key.
 * Supports Freighter and Albedo.
 */
export async function requestAccess(provider?: WalletProvider): Promise<AccessResult> {
  const target = provider ?? (isFreighterAvailable() ? 'freighter' : 'albedo');

  // ── Albedo ──
  if (target === 'albedo') {
    try {
      const albedo = (window as any).albedo;
      if (!albedo) throw new Error('Albedo is not available');
      const result = await albedo.publicKey({ require_existing: false });
      return { address: result.pubkey ?? '' };
    } catch (e: any) {
      return { address: '', error: e?.message ?? 'Albedo access denied' };
    }
  }

  // ── Freighter ──
  const freighterApi = (window as any).freighterApi;

  if (freighterApi?.requestAccess) {
    try {
      const result = await freighterApi.requestAccess();
      if (typeof result === 'string') return { address: result };
      if (result && typeof result === 'object') {
        const address = (result.address || result.publicKey || '').trim();
        return { address, error: result.error };
      }
    } catch (e: any) {
      console.warn('[WalletBridge] freighterApi.requestAccess error:', e);
      return { address: '', error: e.message };
    }
  }

  try {
    const result = await freighterRequestAccess();
    return { address: (result.address || '').trim(), error: result.error as any };
  } catch (e: any) {
    console.error('[WalletBridge] Library requestAccess failed:', e);
    return { address: '', error: e.message };
  }
}

// ─── signTransaction ──────────────────────────────────────────────────────────

/**
 * Sign a transaction XDR string with the user's wallet.
 * Supports Freighter and Albedo.
 */
export async function signTransaction(
  xdr: string,
  network?: string,
  provider?: WalletProvider,
): Promise<SignResult> {
  const target = provider ?? (isFreighterAvailable() ? 'freighter' : 'albedo');

  // ── Albedo ──
  if (target === 'albedo') {
    try {
      const albedo = (window as any).albedo;
      if (!albedo) throw new Error('Albedo is not available');
      const result = await albedo.tx({ xdr, network: network ?? 'testnet', submit: false });
      return { signedTxXdr: result.signed_envelope_xdr ?? '' };
    } catch (e: any) {
      return { signedTxXdr: '', error: e?.message ?? 'Albedo signing failed' };
    }
  }

  // ── Freighter ──
  const freighterApi = (window as any).freighterApi;

  if (freighterApi?.signTransaction && typeof freighterApi.signTransaction === 'function') {
    try {
      const result = await freighterApi.signTransaction(xdr, network);
      if (typeof result === 'string') return { signedTxXdr: result };
      return result;
    } catch (e: any) {
      console.warn('[WalletBridge] freighterApi.signTransaction error:', e);
      return { signedTxXdr: '', error: e.message };
    }
  }

  try {
    const result = await freighterSignTransaction(xdr, { networkPassphrase: network });
    return { signedTxXdr: result.signedTxXdr, error: result.error as any };
  } catch (e: any) {
    console.error('[WalletBridge] Library signTransaction failed:', e);
    return { signedTxXdr: '', error: e.message };
  }
}

// ─── disconnectWallet ─────────────────────────────────────────────────────────

/**
 * Disconnect the wallet session.
 * Freighter doesn't expose a disconnect API — we clear any cached state.
 * Albedo is stateless so nothing to clear.
 */
export async function disconnectWallet(provider?: WalletProvider): Promise<void> {
  const target = provider ?? (isFreighterAvailable() ? 'freighter' : 'albedo');

  if (target === 'freighter') {
    // Freighter has no programmatic disconnect — clear any app-level cached address
    try {
      sessionStorage.removeItem('wata-wallet-address');
    } catch {
      // sessionStorage may not be available in all environments
    }
  }
  // Albedo is request-based and stateless — nothing to disconnect
}

// ─── getAccountBalance ────────────────────────────────────────────────────────

/**
 * Fetch the native XLM balance for a given public key from Horizon.
 * Returns null on error.
 */
export async function getAccountBalance(
  publicKey: string,
  horizonUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${horizonUrl}/accounts/${publicKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    const native = (data.balances as any[])?.find((b: any) => b.asset_type === 'native');
    return native?.balance ?? null;
  } catch (e) {
    console.error('[WalletBridge] getAccountBalance failed:', e);
    return null;
  }
}
