import { useState, useEffect, useCallback, useRef } from 'react';
import { walletBalanceService } from '../services/walletBalance';
import type { WalletBalance, BalanceInfo } from '../services/walletBalance';

export interface UseWalletBalanceReturn {
  balance: WalletBalance | null;
  isLoading: boolean;
  error: string | null;
  isLowBalance: boolean;
  lastUpdated: Date | null;
  refreshBalance: () => Promise<void>;
  getBalanceByAsset: (assetCode: string) => BalanceInfo | null;
  formatBalance: (balance: string, decimals?: number) => string;
  isSufficientBalance: (amount: number, includeReserve?: boolean) => boolean;
}

export function useWalletBalance(
  publicKey: string | null,
  options: { autoRefresh?: boolean; refreshIntervalMs?: number } = {}
): UseWalletBalanceReturn {
  const { autoRefresh = true, refreshIntervalMs = 30_000 } = options;

  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const refreshBalance = useCallback(async () => {
    if (!publicKey || !mountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await walletBalanceService.refreshBalance(publicKey);
      if (mountedRef.current) {
        setBalance(result);
        setLastUpdated(result.lastUpdated);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balance');
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [publicKey]);

  const getBalanceByAsset = useCallback(
    (assetCode: string): BalanceInfo | null => {
      if (!balance) return null;
      return walletBalanceService.getBalanceByAsset(balance, assetCode);
    },
    [balance]
  );

  const formatBalance = useCallback(
    (balanceStr: string, decimals?: number): string =>
      walletBalanceService.formatBalance(balanceStr, decimals),
    []
  );

  const isSufficientBalance = useCallback(
    (amount: number, includeReserve?: boolean): boolean => {
      if (!balance) return false;
      return walletBalanceService.isSufficientBalance(balance, amount, includeReserve);
    },
    [balance]
  );

  useEffect(() => {
    mountedRef.current = true;

    if (!publicKey) return;

    refreshBalance();

    const unsubscribe = walletBalanceService.subscribe((newBalance) => {
      if (mountedRef.current && newBalance.publicKey === publicKey) {
        setBalance(newBalance);
        setLastUpdated(newBalance.lastUpdated);
        setError(null);
      }
    });

    if (autoRefresh) {
      walletBalanceService.startAutoRefresh(publicKey, refreshIntervalMs);
    }

    return () => {
      mountedRef.current = false;
      unsubscribe();
      walletBalanceService.stopAutoRefresh();
    };
  }, [publicKey, autoRefresh, refreshIntervalMs, refreshBalance]);

  const isLowBalance = balance ? walletBalanceService.isLowBalance(balance) : false;

  return {
    balance,
    isLoading,
    error,
    isLowBalance,
    lastUpdated,
    refreshBalance,
    getBalanceByAsset,
    formatBalance,
    isSufficientBalance,
  };
}

export default useWalletBalance;
