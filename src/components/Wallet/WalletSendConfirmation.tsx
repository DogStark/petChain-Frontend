/**
 * WalletSendConfirmation (#1363)
 *
 * Full-screen confirmation step shown before broadcasting a Stellar send.
 * Displays a detailed fee breakdown (base fee, network surcharge, total) and
 * an estimated finality time derived from the selected fee tier.
 */
import React from 'react';
import {
  ArrowRight,
  Clock,
  AlertTriangle,
  Shield,
  Info,
  Zap,
} from 'lucide-react';
import { stroopsToXlm } from '@/utils/stellarAmounts';
import type { FeeEstimate } from '@/types/wallet';

/** Stellar base reserve for a typical tx (100 stroops = 0.000100 XLM). */
const STELLAR_BASE_FEE_STROOPS = 100;

/** Rough finality time per fee level on Stellar mainnet. */
const FINALITY_ESTIMATES: Record<'base' | 'recommended' | 'high', string> = {
  base: '5 – 15 seconds',
  recommended: '3 – 8 seconds',
  high: '1 – 5 seconds',
};

function stroopsToXlmDisplay(stroops: string | number): string {
  try {
    return stroopsToXlm(stroops);
  } catch {
    return '—';
  }
}

function FeeBreakdownRow({
  label,
  value,
  highlight = false,
  sublabel,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  sublabel?: string;
}) {
  return (
    <div className="flex items-start justify-between py-2 text-sm border-b border-gray-100 last:border-0">
      <div>
        <span className="text-gray-600">{label}</span>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      <span className={highlight ? 'font-semibold text-gray-900' : 'text-gray-700'}>{value}</span>
    </div>
  );
}

export interface SendConfirmationPayload {
  sourcePublicKey: string;
  destination: string;
  amount: string;
  asset: string;
  memo?: string;
  feeLevel: 'base' | 'recommended' | 'high';
  feeEstimate: FeeEstimate | null;
  isTestnet: boolean;
}

interface Props {
  payload: SendConfirmationPayload;
  onConfirm: () => void;
  onBack: () => void;
  loading?: boolean;
}

export default function WalletSendConfirmation({ payload, onConfirm, onBack, loading = false }: Props) {
  const {
    sourcePublicKey,
    destination,
    amount,
    asset,
    memo,
    feeLevel,
    feeEstimate,
    isTestnet,
  } = payload;

  const assetCode = asset === 'XLM' ? 'XLM' : asset.split(':')[0];

  // ── Fee math ────────────────────────────────────────────────────────────
  const selectedFeeStroops = feeEstimate ? Number(feeEstimate[feeLevel]) : STELLAR_BASE_FEE_STROOPS;
  const baseFeeStroops = STELLAR_BASE_FEE_STROOPS;
  const networkSurchargeStroops = Math.max(0, selectedFeeStroops - baseFeeStroops);
  const totalFeeXlm = stroopsToXlmDisplay(selectedFeeStroops);
  const baseFeeXlm = stroopsToXlmDisplay(baseFeeStroops);
  const surchargeXlm = stroopsToXlmDisplay(networkSurchargeStroops);

  const finalityTime = FINALITY_ESTIMATES[feeLevel];

  const feeLevelLabel: Record<'base' | 'recommended' | 'high', string> = {
    base: 'Economy',
    recommended: 'Standard',
    high: 'Priority',
  };

  return (
    <div className="max-w-lg mx-auto space-y-5" role="main" aria-label="Transaction confirmation">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 mb-3">
          <Shield size={28} className="text-blue-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Confirm Transaction</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review every detail before sending. This action is irreversible.
        </p>
      </div>

      {/* Transfer summary card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Transfer Details
        </h3>

        {/* Amount */}
        <div className="flex items-center justify-center gap-3 py-4 mb-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">From</p>
            <p className="text-xs font-mono text-gray-600 max-w-[120px] truncate">
              {sourcePublicKey.slice(0, 8)}…{sourcePublicKey.slice(-6)}
            </p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">{amount}</span>
              <span className="text-base font-semibold text-gray-600">{assetCode}</span>
            </div>
            <ArrowRight size={18} className="text-blue-500" aria-hidden="true" />
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">To</p>
            <p className="text-xs font-mono text-gray-600 max-w-[120px] truncate">
              {destination.slice(0, 8)}…{destination.slice(-6)}
            </p>
          </div>
        </div>

        {/* Destination (full) */}
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Destination address</p>
          <p className="text-xs font-mono text-gray-700 break-all bg-gray-50 rounded-lg px-3 py-2">
            {destination}
          </p>
        </div>

        {/* Memo */}
        {memo && (
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Memo</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 italic">
              &ldquo;{memo}&rdquo;
            </p>
          </div>
        )}

        {/* Network */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Network</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isTestnet
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {isTestnet ? 'Testnet' : 'Mainnet'}
          </span>
        </div>
      </div>

      {/* Fee breakdown card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">
            Fee Breakdown
          </h3>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              feeLevel === 'high'
                ? 'bg-orange-100 text-orange-700'
                : feeLevel === 'base'
                ? 'bg-gray-100 text-gray-600'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {feeLevelLabel[feeLevel]}
          </span>
        </div>

        <FeeBreakdownRow
          label="Base fee"
          value={`${baseFeeXlm} XLM`}
          sublabel="Minimum Stellar protocol fee (100 stroops)"
        />

        {networkSurchargeStroops > 0 && (
          <FeeBreakdownRow
            label="Priority surcharge"
            value={`${surchargeXlm} XLM`}
            sublabel="Added to accelerate inclusion in a ledger"
          />
        )}

        <FeeBreakdownRow
          label="Total fee"
          value={`${totalFeeXlm} XLM`}
          highlight
        />

        {/* Finality estimate */}
        <div className="mt-4 flex items-start gap-3 bg-blue-50 rounded-xl px-4 py-3">
          <Zap size={16} className="text-blue-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-blue-700">Estimated finality</p>
            <p className="text-xs text-blue-600 mt-0.5">
              {finalityTime} — Stellar typically closes a ledger every 3–5 seconds.
            </p>
          </div>
        </div>

        {feeEstimate === null && (
          <div className="mt-3 flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">
            <Info size={13} className="flex-shrink-0" aria-hidden="true" />
            Fee estimate unavailable. The base fee (100 stroops) will be used.
          </div>
        )}
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-amber-700">
          Transactions on the Stellar network are <strong>irreversible</strong>. Verify the
          destination address carefully before proceeding.
        </p>
      </div>

      {/* Finality clock */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock size={13} className="flex-shrink-0" aria-hidden="true" />
        Once confirmed, the payment will be visible on-chain within seconds.
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Go Back
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          aria-busy={loading}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending…
            </>
          ) : (
            'Confirm & Send'
          )}
        </button>
      </div>
    </div>
  );
}
