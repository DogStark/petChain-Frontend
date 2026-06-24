import React, { useState } from 'react';
import {
  Copy,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Wallet,
  Plus,
} from 'lucide-react';
import type { WalletAccount, WalletMonitoringData } from '../../types/wallet';

interface Props {
  wallets: WalletAccount[];
  selectedWallet: WalletAccount | null;
  accountData: WalletMonitoringData | null;
  balanceLoading: boolean;
  selectedWalletId: string | null;
  onSelectWallet: (id: string) => void;
  onRefreshBalance: () => void;
  onFundTestnet: () => void;
  onAddWallet: () => void;
  onDeleteWallet: (id: string) => void;
  isTestnet: boolean;
  loading: boolean;
}

function truncate(key: string): string {
  return `${key.slice(0, 8)}...${key.slice(-8)}`;
}

function getExplorerUrl(publicKey: string, isTestnet: boolean): string {
  const base = isTestnet
    ? 'https://stellar.expert/explorer/testnet/account'
    : 'https://stellar.expert/explorer/public/account';
  return `${base}/${publicKey}`;
}

export default function WalletDashboard({
  wallets,
  selectedWallet,
  accountData,
  balanceLoading,
  selectedWalletId,
  onSelectWallet,
  onRefreshBalance,
  onFundTestnet,
  onAddWallet,
  onDeleteWallet,
  isTestnet,
  loading,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function copyAddress() {
    if (!selectedWallet) return;
    navigator.clipboard.writeText(selectedWallet.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const xlmBalance = accountData?.balances.find((b) => b.asset_type === 'native');
  const otherBalances = accountData?.balances.filter((b) => b.asset_type !== 'native') ?? [];

  if (wallets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-blue-50 rounded-full p-6 mb-4">
          <Wallet size={48} className="text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Wallets Yet</h2>
        <p className="text-gray-500 mb-6 max-w-sm">
          Create a new Stellar wallet or import an existing one to manage your PetChain assets.
        </p>
        <button
          onClick={onAddWallet}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} /> Create Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Selector */}
      <div className="flex flex-wrap gap-3 items-center">
        {wallets.map((w) => (
          <button
            key={w.id}
            onClick={() => onSelectWallet(w.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              w.id === selectedWalletId
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            {w.label}
            {w.type === 'multisig' && (
              <span className="ml-2 text-xs bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5">
                Multi-Sig
              </span>
            )}
            {!w.backupVerified && (
              <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 rounded-full px-1.5 py-0.5">
                No Backup
              </span>
            )}
          </button>
        ))}
        <button
          onClick={onAddWallet}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center gap-1"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {selectedWallet && (
        <>
          {/* Address Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedWallet.label}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isTestnet ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {isTestnet ? 'Testnet' : 'Mainnet'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                    {selectedWallet.type === 'multisig' ? 'Multi-Signature' : 'Standard'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onRefreshBalance}
                  disabled={balanceLoading}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Refresh balance"
                >
                  <RefreshCw size={16} className={balanceLoading ? 'animate-spin' : ''} />
                </button>
                <a
                  href={getExplorerUrl(selectedWallet.publicKey, isTestnet)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  title="View on Stellar Explorer"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <code className="text-sm text-gray-700 break-all">
                <span className="hidden sm:inline">{selectedWallet.publicKey}</span>
                <span className="sm:hidden">{truncate(selectedWallet.publicKey)}</span>
              </code>
              <button
                onClick={copyAddress}
                className="ml-3 flex-shrink-0 p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                title="Copy address"
              >
                {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>

            {!selectedWallet.backupVerified && (
              <div className="mt-4 flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                <AlertTriangle size={16} className="flex-shrink-0" />
                Backup not verified. Export your backup before using this wallet with real funds.
              </div>
            )}
          </div>

          {/* Balance Cards */}
          {balanceLoading && !accountData && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-400">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
              Loading account data…
            </div>
          )}

          {!balanceLoading && !accountData && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <p className="text-gray-500 mb-4">
                This account has not been activated on the Stellar network yet.
                {isTestnet && ' Fund it with the Testnet Friendbot to get started.'}
              </p>
              {isTestnet && (
                <button
                  onClick={onFundTestnet}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Funding…' : 'Fund with Friendbot (Testnet)'}
                </button>
              )}
            </div>
          )}

          {accountData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* XLM */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                  XLM Balance
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {xlmBalance
                    ? parseFloat(xlmBalance.balance).toLocaleString(undefined, {
                        maximumFractionDigits: 7,
                      })
                    : '0'}
                </p>
                <p className="text-sm text-gray-400 mt-1">Stellar Lumens</p>
              </div>

              {/* Other assets */}
              {otherBalances.map((b, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                    {b.asset_code ?? 'Unknown'}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {parseFloat(b.balance).toLocaleString(undefined, { maximumFractionDigits: 7 })}
                  </p>
                  {b.limit && <p className="text-sm text-gray-400 mt-1">Limit: {b.limit}</p>}
                </div>
              ))}

              {/* Sequence */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                  Sequence
                </p>
                <p className="text-xl font-semibold text-gray-900 break-all">
                  {accountData.sequence}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Last updated {new Date(accountData.lastFetched).toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}

          {/* Multi-Sig Signers */}
          {accountData && accountData.signers.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Signers</h3>
              <div className="space-y-2">
                {accountData.signers.map((s) => (
                  <div key={s.publicKey} className="flex items-center justify-between text-sm">
                    <code className="text-gray-600 text-xs truncate max-w-xs">{s.publicKey}</code>
                    <span className="ml-4 flex-shrink-0 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      Weight {s.weight}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-gray-500">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="font-semibold text-gray-700">
                    {accountData.thresholds.low_threshold}
                  </p>
                  <p>Low</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="font-semibold text-gray-700">
                    {accountData.thresholds.med_threshold}
                  </p>
                  <p>Medium</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="font-semibold text-gray-700">
                    {accountData.thresholds.high_threshold}
                  </p>
                  <p>High</p>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
            <h3 className="font-semibold text-red-700 mb-2 text-sm">Danger Zone</h3>
            {confirmDelete === selectedWallet.id ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-600">
                  Remove &quot;{selectedWallet.label}&quot; from this device?
                </p>
                <button
                  onClick={() => {
                    onDeleteWallet(selectedWallet.id);
                    setConfirmDelete(null);
                  }}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-3 py-1.5 text-gray-600 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(selectedWallet.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove wallet from this device
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
