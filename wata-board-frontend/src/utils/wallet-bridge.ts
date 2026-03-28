import { 
  isConnected as freighterIsConnected, 
  requestAccess as freighterRequestAccess, 
  signTransaction as freighterSignTransaction 
} from "@stellar/freighter-api";

/**
 * Robust wrapper for Freighter Wallet API
 * In some environments (like Playwright tests), direct access to window.freighterApi
 * may be more reliable than the bundled library imports if the library depends on
 * complex monorePO shared modules.
 */

export async function isConnected(): Promise<{ isConnected: boolean }> {
  console.log('[WalletBridge] isConnected called');
  // Try direct access first if it's been mocked or injected directly
  const freighterApi = (window as any).freighterApi;
  const freighter = (window as any).freighter;
  
  if (freighterApi?.isConnected && typeof freighterApi.isConnected === 'function') {
      try {
          const result = await freighterApi.isConnected();
          console.log('[WalletBridge] window.freighterApi.isConnected result:', result);
          // Handle both boolean and object responses
          if (typeof result === 'boolean') return { isConnected: result };
          if (result && typeof result === 'object' && 'isConnected' in result) return result;
      } catch (e) {
          console.warn('[WalletBridge] Error calling window.freighterApi.isConnected:', e);
      }
  }
  
  // Fallback to library
  try {
      return await freighterIsConnected();
  } catch (e) {
      console.error('[WalletUtil] Library isConnected failed:', e);
      return { isConnected: !!freighter };
  }
}

export async function requestAccess(): Promise<{ address: string; error?: string }> {
  console.log('[WalletBridge] requestAccess function started');
  const freighterApi = (window as any).freighterApi;
  console.log('[WalletBridge] freighterApi on windows:', !!freighterApi);
  
  if (freighterApi?.requestAccess) {
      console.log('[WalletBridge] calling window.freighterApi.requestAccess...');
      try {
          const result = await freighterApi.requestAccess();
          console.log('[WalletBridge] window.freighterApi.requestAccess result:', JSON.stringify(result));
          // Extension usually returns string public key, library v6 returns {address}
          if (typeof result === 'string') return { address: result };
          if (result && typeof result === 'object') {
              const address = (result.address || result.publicKey || '').trim();
              return { address, error: result.error };
          }
      } catch (e: any) {
          console.warn('[WalletBridge] Error calling window.freighterApi.requestAccess:', e);
          return { address: '', error: e.message };
      }
  }

  console.log('[WalletBridge] Falling back to library requestAccess...');
  try {
      const result = await freighterRequestAccess();
      console.log('[WalletBridge] Library requestAccess result:', JSON.stringify(result));
      return { address: (result.address || '').trim(), error: result.error as any };
  } catch (e: any) {
      console.error('[WalletUtil] Library requestAccess failed:', e);
      return { address: '', error: e.message };
  }
}

export async function signTransaction(xdr: string, network?: string): Promise<{ signedTxXdr: string; error?: string }> {
  const freighterApi = (window as any).freighterApi;
  
  if (freighterApi?.signTransaction && typeof freighterApi.signTransaction === 'function') {
      try {
          const result = await freighterApi.signTransaction(xdr, network);
          if (typeof result === 'string') return { signedTxXdr: result };
          return result;
      } catch (e: any) {
          console.warn('[WalletUtil] Error calling window.freighterApi.signTransaction:', e);
          return { signedTxXdr: '', error: e.message };
      }
  }

  // Fallback to library
  try {
      const result = await freighterSignTransaction(xdr, { networkPassphrase: network });
      return { signedTxXdr: result.signedTxXdr, error: result.error as any };
  } catch (e: any) {
      console.error('[WalletUtil] Library signTransaction failed:', e);
      return { signedTxXdr: '', error: e.message };
  }
}
