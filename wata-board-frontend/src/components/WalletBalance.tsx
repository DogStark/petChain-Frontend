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
  refreshBalance?: () => void | Promise<void>;
  showDetails?: boolean;
  showRefreshButton?: boolean;
  className?: string;
}

const formatUsd = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    : 'USD unavailable';

function BalanceSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/40 p-4 ${className}`} aria-busy="true">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="h-3 w-28 rounded bg-slate-800" />
          <div className="h-7 w-36 rounded bg-slate-800" />
          <div className="h-3 w-24 rounded bg-slate-800" />
        </div>
        <div className="h-9 w-9 rounded-lg bg-slate-800" />
      </div>
    </div>
  );
}

export function WalletBalance(props: WalletBalanceProps) {
  const internal = useWalletBalance();
  const {
    balance = internal.balance,
    isLoading = internal.isLoading,
    error = internal.error,
    isConnected = internal.isConnected,
    isLowBalance = internal.isLowBalance,
    lastUpdated = internal.lastUpdated,
    refreshBalance = internal.refreshBalance,
    showDetails = true,
    showRefreshButton = true,
    className = '',
  } = props;

  if (!isConnected) {
    return (
      <section className={`rounded-xl border border-slate-800 bg-slate-950/40 p-4 ${className}`}>
        <p className="text-sm font-medium text-slate-300">Wallet not connected</p>
        <p className="mt-1 text-xs text-slate-500">Connect your Stellar wallet to view balances.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`rounded-xl border border-red-800/50 bg-red-950/20 p-4 ${className}`} role="alert">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-300">Balance unavailable</p>
            <p className="mt-1 text-xs text-red-200">{error}</p>
          </div>
          {showRefreshButton && (
            <button
              type="button"
              onClick={() => void refreshBalance()}
              className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30"
            >
              Retry
            </button>
          )}
        </div>
      </section>
    );
  }

  if (isLoading || !balance) {
    return <BalanceSkeleton className={className} />;
  }

  const xlmBalance = balance.balances.find((assetBalance) => assetBalance.isNative);
  const balanceStatusColor = balanceUtils.getBalanceStatusColor(balance);
  const balanceStatusText = balanceUtils.getBalanceStatusText(balance);

  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-950/40 p-4 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Wallet Balance</p>
          <p className={`mt-1 text-2xl font-semibold ${balanceStatusColor}`}>
            {xlmBalance ? balanceUtils.formatXLM(xlmBalance.balance) : '0.00 XLM'}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-300">{formatUsd(balance.totalBalanceUSD)}</p>
          <p className={`mt-1 text-xs ${balanceStatusColor}`}>{balanceStatusText}</p>
        </div>

        {showRefreshButton && (
          <button
            type="button"
            onClick={() => void refreshBalance()}
            disabled={isLoading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Refresh balance"
            aria-label="Refresh wallet balance"
          >
            <svg className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h5M20 20v-5h-5M5.6 16.5A8 8 0 0 0 18.4 18M18.4 7.5A8 8 0 0 0 5.6 6"
              />
            </svg>
          </button>
        )}
      </div>

      {isLowBalance && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-200">Low balance detected. Add XLM to cover payments and network fees.</p>
        </div>
      )}

      {lastUpdated && <p className="mt-3 text-xs text-slate-500">Last updated: {lastUpdated.toLocaleTimeString()}</p>}

      {showDetails && balance.balances.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assets</p>
          {balance.balances.map((assetBalance) => (
            <div
              key={`${assetBalance.assetCode}-${assetBalance.assetIssuer ?? 'native'}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${assetBalance.isNative ? 'bg-sky-500' : 'bg-violet-500'}`} />
                <span className="truncate text-slate-300">{balanceUtils.getAssetDisplayName(assetBalance)}</span>
              </div>
              <span className="shrink-0 font-medium text-slate-100">{balanceUtils.formatBalance(assetBalance.balance)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
