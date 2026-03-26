import React, { useState, useEffect } from 'react';
import { Send, ExternalLink, AlertTriangle, CheckCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import type { WalletAccount, BroadcastResult, FeeEstimate, WalletBalance } from '../../types/wallet';

interface Props {
  wallet: WalletAccount | null;
  balances: WalletBalance[];
  feeEstimate: FeeEstimate | null;
  onSendPayment: (
    pin: string,
    tx: { sourcePublicKey: string; destination: string; amount: string; asset: string; memo?: string; fee?: string }
  ) => Promise<BroadcastResult>;
  onRefreshFee: () => Promise<FeeEstimate | null>;
  loading: boolean;
  error: string | null;
  onClearError: () => void;
  isTestnet: boolean;
}

function getExplorerTxUrl(hash: string, isTestnet: boolean): string {
  const base = isTestnet
    ? 'https://stellar.expert/explorer/testnet/tx'
    : 'https://stellar.expert/explorer/public/tx';
  return `${base}/${hash}`;
}

function stroopsToXLM(stroops: string): string {
  return (parseInt(stroops) / 10_000_000).toFixed(7);
}

export default function TransactionSigning({
  wallet,
  balances,
  feeEstimate,
  onSendPayment,
  onRefreshFee,
  loading,
  error,
  onClearError,
  isTestnet,
}: Props) {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('XLM');
  const [memo, setMemo] = useState('');
  const [feeLevel, setFeeLevel] = useState<'base' | 'recommended' | 'high'>('recommended');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Build asset options from balances
  const assetOptions = [
    { label: 'XLM (Stellar Lumens)', value: 'XLM' },
    ...balances
      .filter((b) => b.asset_type !== 'native' && b.asset_code)
      .map((b) => ({
        label: `${b.asset_code} — Balance: ${parseFloat(b.balance).toFixed(7)}`,
        value: `${b.asset_code}:${b.asset_issuer}`,
      })),
  ];

  const xlmBalance = balances.find((b) => b.asset_type === 'native');
  const currentBalance =
    selectedAsset === 'XLM'
      ? xlmBalance?.balance ?? '0'
      : balances.find((b) => `${b.asset_code}:${b.asset_issuer}` === selectedAsset)?.balance ?? '0';

  const selectedFee = feeEstimate ? feeEstimate[feeLevel] : null;

  function validate(): string | null {
    if (!destination.trim()) return 'Destination address is required.';
    if (!destination.startsWith('G') || destination.length !== 56)
      return 'Invalid destination — must be a 56-character Stellar public key starting with G.';
    if (wallet && destination === wallet.publicKey)
      return 'Cannot send to your own address.';
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
      return 'Enter a valid positive amount.';
    if (parseFloat(amount) > parseFloat(currentBalance))
      return `Insufficient balance. Available: ${parseFloat(currentBalance).toLocaleString()} ${selectedAsset === 'XLM' ? 'XLM' : selectedAsset.split(':')[0]}`;
    if (memo.length > 28) return 'Memo must be 28 characters or fewer.';
    if (!pin) return 'PIN is required to sign the transaction.';
    return null;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    onClearError();
    setLocalError(null);
    setResult(null);

    const err = validate();
    if (err) {
      setLocalError(err);
      return;
    }

    try {
      const res = await onSendPayment(pin, {
        sourcePublicKey: wallet!.publicKey,
        destination: destination.trim(),
        amount,
        asset: selectedAsset,
        memo: memo.trim() || undefined,
        fee: selectedFee ?? undefined,
      });
      setResult(res);
      setDestination('');
      setAmount('');
      setMemo('');
      setPin('');
    } catch {
      // error surfaced by hook
    }
  }

  const displayError = localError || error;

  if (!wallet) {
    return <div className="text-center py-12 text-gray-400">Select a wallet to send a transaction.</div>;
  }

  return (
    <div className="max-w-lg space-y-5">
      {displayError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0" /> {displayError}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 text-green-700 mb-2">
            <CheckCircle size={18} />
            <span className="font-semibold text-sm">Transaction submitted successfully</span>
          </div>
          <p className="text-xs text-gray-500 font-mono break-all mb-3">{result.hash}</p>
          <a
            href={getExplorerTxUrl(result.hash, isTestnet)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink size={13} /> View on Stellar Explorer
          </a>
        </div>
      )}

      <form onSubmit={handleSend} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Send Payment</h3>

        {/* Asset */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {assetOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Available: {parseFloat(currentBalance).toLocaleString(undefined, { maximumFractionDigits: 7 })}{' '}
            {selectedAsset === 'XLM' ? 'XLM' : selectedAsset.split(':')[0]}
          </p>
        </div>

        {/* Destination */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destination Address</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value.trim())}
            placeholder="G... (56-character Stellar public key)"
            className={`w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              destination && (!destination.startsWith('G') || destination.length !== 56)
                ? 'border-red-400'
                : 'border-gray-300'
            }`}
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0000000"
              min="0"
              step="0.0000001"
              className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 font-medium">
              {selectedAsset === 'XLM' ? 'XLM' : selectedAsset.split(':')[0]}
            </span>
          </div>
        </div>

        {/* Memo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Memo <span className="text-gray-400 font-normal">(optional, max 28 chars)</span>
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={28}
            placeholder="e.g. Payment for vet visit"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Fee Selector */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">Transaction Fee</label>
            <button
              type="button"
              onClick={async () => { await onRefreshFee(); }}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['base', 'recommended', 'high'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFeeLevel(level)}
                className={`px-3 py-2 rounded-lg border text-xs transition-colors ${
                  feeLevel === level
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                }`}
              >
                <p className="font-medium capitalize">{level === 'recommended' ? 'Standard' : level}</p>
                {feeEstimate && (
                  <p className="text-xs opacity-75 mt-0.5">{stroopsToXLM(feeEstimate[level])} XLM</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* PIN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Wallet PIN</label>
          <div className="relative">
            <input
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN to sign…"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPin((s) => !s)}
              className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Summary */}
        {destination && amount && parseFloat(amount) > 0 && (
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-600 space-y-1">
            <p>Sending <strong>{amount} {selectedAsset === 'XLM' ? 'XLM' : selectedAsset.split(':')[0]}</strong></p>
            <p>To <code className="text-gray-800">{destination.slice(0, 10)}…{destination.slice(-6)}</code></p>
            {selectedFee && <p>Fee ~{stroopsToXLM(selectedFee)} XLM</p>}
            {memo && <p>Memo: &quot;{memo}&quot;</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Send size={15} />
          {loading ? 'Signing & broadcasting…' : 'Send Transaction'}
        </button>
      </form>
    </div>
  );
}
