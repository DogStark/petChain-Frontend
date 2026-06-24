import { useState, useEffect, useCallback, useRef } from 'react';
import { walletService } from '../lib/wallet/walletService';
import type {
  WalletAccount,
  WalletMonitoringData,
  WalletTransaction,
  BroadcastResult,
  MultiSigConfig,
  BackupData,
  FeeEstimate,
} from '../types/wallet';

const BALANCE_POLL_INTERVAL = 30_000; // 30 seconds

export function useWallet() {
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<WalletMonitoringData | null>(null);
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) ?? null;

  // ─── Load wallets from local storage on mount ──────────────────────────────
  useEffect(() => {
    const stored = walletService.getWallets();
    setWallets(stored);
    if (stored.length > 0 && !selectedWalletId) {
      setSelectedWalletId(stored[0].id);
    }
  }, []);

  // ─── Poll balance whenever selected wallet changes ─────────────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (!selectedWallet) {
      setAccountData(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        setBalanceLoading(true);
        const data = await walletService.fetchAccountData(selectedWallet.publicKey);
        setAccountData(data);
      } catch (err) {
        // Account may not be funded yet — not a hard error
        setAccountData(null);
      } finally {
        setBalanceLoading(false);
      }
    };

    fetchBalance();
    pollRef.current = setInterval(fetchBalance, BALANCE_POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedWallet?.id]);

  // ─── Fee estimate on mount ─────────────────────────────────────────────────
  useEffect(() => {
    walletService
      .estimateFee()
      .then(setFeeEstimate)
      .catch(() => null);
  }, []);

  const refreshWallets = useCallback(() => {
    const stored = walletService.getWallets();
    setWallets(stored);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!selectedWallet) return;
    try {
      setBalanceLoading(true);
      const data = await walletService.fetchAccountData(selectedWallet.publicKey);
      setAccountData(data);
    } catch {
      setAccountData(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [selectedWallet]);

  // ─── Wallet creation ───────────────────────────────────────────────────────
  const createWallet = useCallback(async (label: string, pin: string) => {
    setLoading(true);
    setError(null);
    try {
      const wallet = await walletService.createWallet(label, pin);
      setWallets(walletService.getWallets());
      setSelectedWalletId(wallet.id);
      return wallet;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create wallet.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Wallet import ─────────────────────────────────────────────────────────
  const importWallet = useCallback(async (secretKey: string, label: string, pin: string) => {
    setLoading(true);
    setError(null);
    try {
      const wallet = await walletService.importWallet(secretKey, label, pin);
      setWallets(walletService.getWallets());
      setSelectedWalletId(wallet.id);
      return wallet;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import wallet.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Wallet deletion ───────────────────────────────────────────────────────
  const deleteWallet = useCallback(
    (id: string) => {
      walletService.deleteWallet(id);
      const updated = walletService.getWallets();
      setWallets(updated);
      if (selectedWalletId === id) {
        setSelectedWalletId(updated[0]?.id ?? null);
      }
    },
    [selectedWalletId]
  );

  // ─── Send payment ──────────────────────────────────────────────────────────
  const sendPayment = useCallback(
    async (pin: string, tx: WalletTransaction): Promise<BroadcastResult> => {
      if (!selectedWallet) throw new Error('No wallet selected.');
      setLoading(true);
      setError(null);
      try {
        const result = await walletService.sendPayment(selectedWallet, pin, tx);
        await refreshBalance();
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transaction failed.';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selectedWallet, refreshBalance]
  );

  // ─── Multi-sig setup ───────────────────────────────────────────────────────
  const setupMultiSig = useCallback(
    async (pin: string, config: MultiSigConfig): Promise<BroadcastResult> => {
      if (!selectedWallet) throw new Error('No wallet selected.');
      setLoading(true);
      setError(null);
      try {
        const result = await walletService.setupMultiSig(selectedWallet, pin, config);
        setWallets(walletService.getWallets());
        await refreshBalance();
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Multi-sig setup failed.';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selectedWallet, refreshBalance]
  );

  const removeSigner = useCallback(
    async (pin: string, signerPublicKey: string): Promise<BroadcastResult> => {
      if (!selectedWallet) throw new Error('No wallet selected.');
      setLoading(true);
      setError(null);
      try {
        const result = await walletService.removeSigner(selectedWallet, pin, signerPublicKey);
        await refreshBalance();
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to remove signer.';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selectedWallet, refreshBalance]
  );

  // ─── Backup & recovery ─────────────────────────────────────────────────────
  const exportBackup = useCallback(
    async (pin: string): Promise<BackupData> => {
      if (!selectedWallet) throw new Error('No wallet selected.');
      const backup = await walletService.exportBackup(selectedWallet, pin);
      walletService.markBackupVerified(selectedWallet.id);
      setWallets(walletService.getWallets());
      return backup;
    },
    [selectedWallet]
  );

  const importBackup = useCallback(async (backup: BackupData, pin: string) => {
    setLoading(true);
    setError(null);
    try {
      const wallet = await walletService.importBackup(backup, pin);
      setWallets(walletService.getWallets());
      setSelectedWalletId(wallet.id);
      return wallet;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to restore from backup.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Testnet funding ───────────────────────────────────────────────────────
  const fundTestnet = useCallback(async () => {
    if (!selectedWallet) throw new Error('No wallet selected.');
    setLoading(true);
    setError(null);
    try {
      await walletService.fundTestnetAccount(selectedWallet.publicKey);
      await refreshBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Funding failed.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedWallet, refreshBalance]);

  return {
    // State
    wallets,
    selectedWallet,
    selectedWalletId,
    accountData,
    feeEstimate,
    loading,
    balanceLoading,
    error,
    // Selectors
    setSelectedWalletId,
    clearError: () => setError(null),
    // Actions
    createWallet,
    importWallet,
    deleteWallet,
    refreshWallets,
    refreshBalance,
    sendPayment,
    setupMultiSig,
    removeSigner,
    exportBackup,
    importBackup,
    fundTestnet,
  };
}
