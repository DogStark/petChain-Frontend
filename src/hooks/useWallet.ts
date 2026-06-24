import { useState, useEffect, useCallback } from 'react';
import { stellarService, AccountDetails } from '@/lib/blockchain';

export type WalletState = 'idle' | 'loading' | 'loaded' | 'error';

export interface WalletData {
  publicKey: string;
  balances: AccountDetails['balances'];
}

export interface UseWalletReturn {
  wallet: WalletData | null;
  state: WalletState;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWallet(publicKey: string | null, pollInterval = 30000): UseWalletReturn {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [state, setState] = useState<WalletState>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    setState('loading');
    setError(null);
    try {
      const account = await stellarService.getAccount(publicKey);
      setWallet({ publicKey: account.publicKey, balances: account.balances });
      setState('loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
      setState('error');
    }
  }, [publicKey]);

  useEffect(() => {
    fetchBalance();
    if (!publicKey) return;
    const timer = setInterval(fetchBalance, pollInterval);
    return () => clearInterval(timer);
  }, [fetchBalance, publicKey, pollInterval]);

  return { wallet, state, error, refresh: fetchBalance };
}
