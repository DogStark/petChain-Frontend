import React, { useState } from 'react';
import {
  Link2,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  AlertCircle,
  QrCode,
  DollarSign,
  ArrowRight,
  Info,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { usePaymentRequest } from '@/hooks/usePaymentRequest';
import { SUPPORTED_PAYMENT_ASSETS } from '@/utils/paymentRequest';

interface Props {
  defaultDestination?: string;
  onSuccess?: (url: string) => void;
}

const EXPIRY_OPTIONS = [
  { label: '15 Minutes', value: 15 },
  { label: '1 Hour', value: 60 },
  { label: '24 Hours', value: 1440 },
  { label: '7 Days', value: 10080 },
];

export const PaymentRequestGenerator: React.FC<Props> = ({ defaultDestination = '', onSuccess }) => {
  const {
    loading,
    error,
    activeRequest,
    shareableUrl,
    timeRemaining,
    createPaymentRequest,
    reset,
  } = usePaymentRequest();

  const [asset, setAsset] = useState<string>('XLM');
  const [amount, setAmount] = useState<string>('');
  const [destination, setDestination] = useState<string>(defaultDestination);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number>(60);
  const [memo, setMemo] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [showQR, setShowQR] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const req = await createPaymentRequest({
      asset,
      amount,
      destination,
      expiresInMinutes,
      memo: memo.trim() || undefined,
      note: note.trim() || undefined,
    });

    if (req && onSuccess && shareableUrl) {
      onSuccess(shareableUrl);
    }
  };

  const copyToClipboard = async () => {
    if (!shareableUrl) return;
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl" aria-hidden="true">
          <Link2 size={24} />
        </div>
        <div>
          <h2 id="payment-req-heading" className="text-lg font-semibold text-gray-900">
            Payment Request Link
          </h2>
          <p className="text-xs text-gray-500">
            Create an expiring link to request funds directly into your wallet.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2.5"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!activeRequest ? (
        <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="payment-req-heading">
          {/* Asset Selection */}
          <div>
            <label htmlFor="req-asset" className="block text-xs font-semibold text-gray-700 mb-1">
              Asset
            </label>
            <select
              id="req-asset"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              {SUPPORTED_PAYMENT_ASSETS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input */}
          <div>
            <label htmlFor="req-amount" className="block text-xs font-semibold text-gray-700 mb-1">
              Amount
            </label>
            <div className="relative">
              <input
                id="req-amount"
                type="number"
                step="any"
                min="0.0000001"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full pl-3.5 pr-14 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                {asset}
              </span>
            </div>
          </div>

          {/* Destination Address */}
          <div>
            <label htmlFor="req-destination" className="block text-xs font-semibold text-gray-700 mb-1">
              Destination Address (Public Key)
            </label>
            <input
              id="req-destination"
              type="text"
              placeholder="G..."
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p className="mt-1 text-[11px] text-gray-400 flex items-center gap-1">
              <ShieldCheck size={13} className="text-emerald-500" aria-hidden="true" />
              <span>Privacy protected: Link will never expose private keys or seed phrases.</span>
            </p>
          </div>

          {/* Expiry Selection */}
          <div>
            <label htmlFor="req-expiry" className="block text-xs font-semibold text-gray-700 mb-1">
              Link Expiry Time
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setExpiresInMinutes(opt.value)}
                  className={`px-3 py-2 text-xs font-medium rounded-xl border text-center transition-all ${
                    expiresInMinutes === opt.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  aria-pressed={expiresInMinutes === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Memo & Purpose Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="req-memo" className="block text-xs font-semibold text-gray-700 mb-1">
                Memo (Optional)
              </label>
              <input
                id="req-memo"
                type="text"
                placeholder="e.g. Pet medication"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={28}
                className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="req-note" className="block text-xs font-semibold text-gray-700 mb-1">
                Public Note / Reference
              </label>
              <input
                id="req-note"
                type="text"
                placeholder="e.g. Clinic visit payment"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              {loading ? 'Creating Request Link...' : 'Generate Shareable Link'}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5" aria-labelledby="created-link-heading">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <h3 id="created-link-heading" className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5 mb-1">
              <Check size={16} className="text-emerald-600" aria-hidden="true" />
              Payment Request Ready to Share
            </h3>
            <p className="text-xs text-emerald-700">
              Anyone with this link can view the request amount and send the exact funds before it expires.
            </p>
          </div>

          {/* Details summary */}
          <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs border border-gray-100">
            <div className="flex justify-between items-center text-gray-600">
              <span>Requested Amount:</span>
              <span className="font-bold text-gray-900 text-sm">
                {activeRequest.amount} {activeRequest.asset}
              </span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Destination:</span>
              <span className="font-mono text-gray-700 truncate max-w-[220px]" title={activeRequest.destination}>
                {activeRequest.destination}
              </span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Status & Expiry:</span>
              <span className="flex items-center gap-1 text-amber-700 font-semibold">
                <Clock size={13} aria-hidden="true" />
                {timeRemaining}
              </span>
            </div>
            {activeRequest.note && (
              <div className="flex justify-between items-center text-gray-600 pt-1 border-t border-gray-200/60">
                <span>Note:</span>
                <span className="text-gray-800 italic">{activeRequest.note}</span>
              </div>
            )}
          </div>

          {/* Shareable Link Box */}
          <div>
            <label htmlFor="shareable-link-url" className="block text-xs font-semibold text-gray-700 mb-1">
              Shareable Payment Link
            </label>
            <div className="flex items-center gap-2">
              <input
                id="shareable-link-url"
                type="text"
                readOnly
                value={shareableUrl || ''}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono text-gray-700 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={copyToClipboard}
                aria-label={copied ? 'Link copied to clipboard' : 'Copy payment link'}
                className="flex items-center gap-1 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shrink-0 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Toggle QR code */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowQR((prev) => !prev)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5 focus-visible:underline"
              aria-expanded={showQR}
            >
              <QrCode size={15} aria-hidden="true" />
              {showQR ? 'Hide QR Code' : 'Show QR Code for scanning'}
            </button>

            {showQR && shareableUrl && (
              <div className="mt-3 flex flex-col items-center p-4 bg-white border border-gray-200 rounded-xl shadow-inner">
                <QRCodeSVG value={shareableUrl} size={150} level="M" />
                <p className="mt-2 text-[11px] text-gray-400">Scan with a mobile camera or wallet</p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 flex justify-between">
            <button
              type="button"
              onClick={reset}
              className="text-xs text-gray-500 hover:text-gray-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
            >
              Create another payment request
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentRequestGenerator;
