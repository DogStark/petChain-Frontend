import React from 'react';
import type { WalletBalance as WalletBalanceType } from '../services/walletBalance';
import { balanceUtils } from '../services/walletBalance';
import { useWalletBalance } from '../hooks/useWalletBalance';

interface WalletBalanceProps {
  balance?: WalletBalanceType | null;
  isLoading?: boolean;
  error?: string | null;
  isConnected?: boolean;
  isLowBalance?: boolean;
  lastUpdated?: Date | null;
  refreshBalance?: () => void;
  showDetails?: boolean;
  showRefreshButton?: boolean;
  className?: string;
}

export const WalletBalance: React.FC<WalletBalanceProps> = (props) => {
  // Use internal hook if props are not provided
  const internal = useWalletBalance();
  
  const {
    balance = internal.balance,
    isLoading = internal.isLoading,
    error = internal.error,
    isConnected = internal.isConnected,
    isLowBalance = internal.isLowBalance,
    lastUpdated = internal.lastUpdated,
    refreshBalance = internal.refreshBalance,
    showDetails = false,
    showRefreshButton = true,
    className = ''
  } = props;

  console.log('[WalletBalance Component] Render state:', { isConnected, isLoading, hasBalance: !!balance, hasError: !!error });

  if (!isConnected) {
    return (
      <div className={`rounded-xl border border-slate-800 bg-slate-950/40 p-4 ${className}`}>
        <div className="text-sm text-slate-400">Wallet not connected</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-red-800/50 bg-red-950/20 p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-red-400">Balance Error</div>
            <div className="text-xs text-red-300 mt-1">{error}</div>
          </div>
          {showRefreshButton && (
            <button
              onClick={refreshBalance}
              className="px-3 py-1 text-xs bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading || !balance) {
    return (
      <div className={`rounded-xl border border-slate-800 bg-slate-950/40 p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-600 border-t-sky-500"></div>
          <div className="text-sm text-slate-400">Loading balance...</div>
        </div>
      </div>
    );
  }

  const xlmBalance = balance.balances.find(b => b.isNative);
  const balanceStatusColor = balanceUtils.getBalanceStatusColor(balance);
  const balanceStatusText = balanceUtils.getBalanceStatusText(balance);

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/40 p-4 ${className}`}>
      {/* Main Balance Display */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Wallet Balance
          </div>
          <div className={`text-lg font-semibold ${balanceStatusColor}`}>
            {xlmBalance ? balanceUtils.formatXLM(xlmBalance.balance) : '0 XLM'}
          </div>
          <div className={`text-xs ${balanceStatusColor} mt-1`}>
            {balanceStatusText}
            {isLowBalance && (
              <span className="ml-2 text-amber-400">⚠️ Low Balance</span>
            )}
          </div>
        </div>
        
        {showRefreshButton && (
          <button
            onClick={refreshBalance}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh balance"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* Low Balance Warning */}
      {isLowBalance && (
        <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="text-xs text-amber-300">
            ⚠️ Low balance detected. You may need additional XLM for transaction fees.
          </div>
        </div>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-xs text-slate-500 mb-3">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {/* Detailed Balance Information */}
      {showDetails && (
        <div className="space-y-2 pt-3 border-t border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            All Balances
          </div>
          {balance.balances.map((assetBalance, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  assetBalance.isNative ? 'bg-sky-500' : 'bg-purple-500'
                }`}></div>
                <span className="text-slate-300">
                  {balanceUtils.getAssetDisplayName(assetBalance)}
                </span>
              </div>
              <span className="text-slate-100 font-medium">
                {balanceUtils.formatBalance(assetBalance.balance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
