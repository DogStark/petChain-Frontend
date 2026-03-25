/**
 * React hook for wallet balance management
 * Provides real-time balance updates and wallet state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { walletBalanceService } from '../services/walletBalance';
import type { WalletBalance, BalanceInfo } from '../services/walletBalance';
import { isConnected } from '../utils/wallet-bridge';

export interface UseWalletBalanceReturn {
  balance: WalletBalance | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  isLowBalance: boolean;
  lastUpdated: Date | null;
  refreshBalance: () => Promise<void>;
  getBalanceByAsset: (assetCode: string) => BalanceInfo | null;
  formatBalance: (balance: string, decimals?: number) => string;
  isSufficientBalance: (amount: number, includeReserve?: boolean) => boolean;
}

export function useWalletBalance(autoRefresh: boolean = true): UseWalletBalanceReturn {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const mountedRef = useRef(true);
  const subscriptionRef = useRef<(() => void) | null>(null);

  // Check wallet connection status
  const checkWalletConnection = useCallback(async () => {
    try {
      const result = await isConnected();
      const connected = !!result.isConnected;
      console.log('[useWalletBalance] isConnected result:', JSON.stringify(result));
      setWalletConnected(connected);
      return connected;
    } catch (err) {
      console.error('[useWalletBalance] Failed to check wallet connection:', err);
      setWalletConnected(false);
      return false;
    }
  }, []);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!mountedRef.current) return;

    const connected = await checkWalletConnection();
    if (!connected) {
      setBalance(null);
      setError('Wallet not connected');
      setLastUpdated(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const walletBalance = await walletBalanceService.refreshBalance();
      if (mountedRef.current) {
        setBalance(walletBalance);
        setLastUpdated(walletBalance?.lastUpdated || new Date());
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance';
        setError(errorMessage);
        console.error('Balance refresh failed:', err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [checkWalletConnection]);

  // Get balance by asset code
  const getBalanceByAsset = useCallback((assetCode: string): BalanceInfo | null => {
    if (!balance) return null;
    return walletBalanceService.getBalanceByAsset(balance, assetCode);
  }, [balance]);

  // Format balance for display
  const formatBalance = useCallback((balanceStr: string, decimals: number = 7): string => {
    return walletBalanceService.formatBalance(balanceStr, decimals);
  }, []);

  // Check if balance is sufficient for transaction
  const isSufficientBalance = useCallback((amount: number, includeReserve: boolean = true): boolean => {
    if (!balance) return false;
    return walletBalanceService.isSufficientBalance(balance, amount, includeReserve);
  }, [balance]);

  // Check if balance is low
  const isLowBalance = balance ? walletBalanceService.isLowBalance(balance) : false;

  // Initialize and setup real-time updates
  useEffect(() => {
    mountedRef.current = true;

    // Initial load
    refreshBalance();

    // Subscribe to balance updates
    subscriptionRef.current = walletBalanceService.subscribe((newBalance) => {
      if (mountedRef.current) {
        setBalance(newBalance);
        setLastUpdated(newBalance.lastUpdated);
        setError(null);
        setIsLoading(false);
      }
    });

    // Start real-time updates if enabled
    if (autoRefresh) {
      walletBalanceService.startRealTimeUpdates(15000); // Update every 15 seconds
    }

    // Periodic connection check
    const connectionCheckInterval = setInterval(checkWalletConnection, 5000);

    return () => {
      mountedRef.current = false;
      
      // Cleanup subscription
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
      
      // Stop real-time updates
      walletBalanceService.stopRealTimeUpdates();
      
      // Clear connection check
      clearInterval(connectionCheckInterval);
    };
  }, [refreshBalance, autoRefresh, checkWalletConnection]);

  return {
    balance,
    isLoading,
    error,
    isConnected: walletConnected,
    isLowBalance,
    lastUpdated,
    refreshBalance,
    getBalanceByAsset,
    formatBalance,
    isSufficientBalance
  };
}

// Hook for balance history (optional feature)
export function useBalanceHistory() {
  const [history, setHistory] = useState<WalletBalance[]>([]);

  const addToHistory = useCallback((balance: WalletBalance) => {
    setHistory((prev: WalletBalance[]) => {
      const newHistory = [...prev, balance];
      // Keep only last 50 entries
      return newHistory.slice(-50);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    isLoading: false,
    addToHistory,
    clearHistory
  };
}

// Hook for balance notifications
export function useBalanceNotifications() {
  const [notifications, setNotifications] = useState<string[]>([]);

  const addNotification = useCallback((message: string) => {
    setNotifications((prev: string[]) => [...prev, message]);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev: string[]) => prev.slice(1));
    }, 5000);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    addNotification,
    clearNotifications
  };
}

export default useWalletBalance;
