import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import type { WalletReceipt } from '../../lib/wallet/walletReceipts';

interface Props {
  receipt: WalletReceipt;
  onClose?: () => void;
  onRefreshStatus?: () => void;
}

const statusConfig: Record<
  WalletReceipt['status']['finality'],
  { icon: React.ComponentType<{ className?: string }>; bg: string; text: string; border: string }
> = {
  confirmed: {
    icon: CheckCircle2,
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
  },
  accepted: {
    icon: Clock,
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
  },
  submitted: {
    icon: Clock,
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  failed: {
    icon: XCircle,
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
  },
  unknown: {
    icon: AlertCircle,
    bg: 'bg-gray-50',
    text: 'text-gray-800',
    border: 'border-gray-200',
  },
};

export default function WalletConfirmationReceiptView({
  receipt,
  onClose,
  onRefreshStatus,
}: Props) {
  const { intent, submitted, status, explorer, isMultiOperation, operationIndex, operationCount } =
    receipt;
  const config = statusConfig[status.finality] || statusConfig.unknown;
  const StatusIcon = config.icon;

  const actionTitleMap: Record<string, string> = {
    send_payment: 'Send Payment Receipt',
    multi_sig_setup: 'Multi-Signature Setup Receipt',
    multi_sig_remove_signer: 'Remove Signer Receipt',
  };

  return (
    <div
      role="region"
      aria-label="Transaction confirmation receipt"
      className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-xl w-full mx-auto overflow-hidden"
    >
      {/* Header */}
      <div className={`p-6 border-b ${config.border} ${config.bg} flex items-start justify-between`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl bg-white shadow-sm ${config.text}`}>
            <StatusIcon className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 text-gray-700">
                Audit Receipt {isMultiOperation && operationIndex !== undefined && `(${operationIndex + 1}/${operationCount})`}
              </span>
              <span className="text-xs text-gray-500 uppercase">{intent.network}</span>
            </div>
            <h2 className={`text-xl font-bold mt-1 ${config.text}`}>
              {actionTitleMap[intent.action] || 'Wallet Action Receipt'}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {intent.memo ? `Memo: "${intent.memo}"` : 'Secured on Stellar Network'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/50"
            aria-label="Close receipt"
          >
            ✕
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Final Status & Guidance */}
        <div className={`rounded-xl p-4 border ${config.border} ${config.bg}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Final Status
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold uppercase ${config.text}`}>
                {status.label}
              </span>
              {onRefreshStatus && (
                <button
                  onClick={onRefreshStatus}
                  className="p-1 text-gray-500 hover:text-gray-700 rounded-md"
                  title="Refresh status"
                  aria-label="Refresh status"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-700">{status.guidance}</p>
          {submitted.error && (
            <p className="text-xs text-red-600 mt-2 font-mono bg-white p-2 rounded border border-red-100">
              Error: {submitted.error}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200/60 text-xs text-gray-500">
            <span>Confirmations: <strong>{status.confirmations}</strong></span>
            {status.blockNumber && <span>Block: <strong>{status.blockNumber}</strong></span>}
            {submitted.ledger > 0 && <span>Ledger: <strong>{submitted.ledger}</strong></span>}
          </div>
        </div>

        {/* Intent vs Submitted Operation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Intent */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Requested Intent
            </h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Action:</span>
                <span className="font-medium text-gray-900 capitalize">{intent.action.replace(/_/g, ' ')}</span>
              </div>
              {intent.amountAsset && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Target Amount:</span>
                  <span className="font-medium text-gray-900">{intent.amountAsset}</span>
                </div>
              )}
              {intent.destination && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Recipient:</span>
                  <span className="font-mono text-gray-900">
                    {intent.destination.slice(0, 6)}…{intent.destination.slice(-4)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Submitted Operation */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Submitted Operation
            </h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Source:</span>
                <span className="font-mono text-gray-900">
                  {intent.sourcePublicKey.slice(0, 6)}…{intent.sourcePublicKey.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Broadcast:</span>
                <span className={`font-semibold ${submitted.successful ? 'text-green-600' : 'text-red-600'}`}>
                  {submitted.successful ? 'Successful' : 'Failed'}
                </span>
              </div>
              {submitted.hash && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tx Hash:</span>
                  <span className="font-mono text-gray-900">
                    {submitted.hash.slice(0, 8)}…
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Explorer Link & Metadata */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <p>Hash: <code className="font-mono text-gray-700">{submitted.hash ? `${submitted.hash.slice(0, 16)}...` : 'N/A'}</code></p>
            <p className="mt-0.5">Created: {new Date(intent.createdAt).toLocaleString()}</p>
          </div>
          {explorer.url && (
            <a
              href={explorer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition-colors w-full sm:w-auto justify-center"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              {explorer.label}
            </a>
          )}
        </div>

        {/* Security Audit Notice */}
        <div className="flex items-center gap-2 text-[11px] text-gray-400 bg-gray-50/80 p-2.5 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" aria-hidden="true" />
          <span>Audit-friendly receipt: Sensitive signing material was never persisted or displayed.</span>
        </div>
      </div>
    </div>
  );
}
