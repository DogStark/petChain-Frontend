import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wallet,
  ArrowRight,
  ExternalLink,
  Loader2,
  Lock,
} from 'lucide-react';
import { usePaymentRequest } from '@/hooks/usePaymentRequest';
import { useWallet } from '@/hooks/useWallet';
import { formatExpiryTimeRemaining } from '@/utils/paymentRequest';

interface Props {
  initialReqPayload?: string;
}

export const PaymentRequestView: React.FC<Props> = ({ initialReqPayload }) => {
  const router = useRouter();
  const { req } = router.query;
  const payloadToResolve = (req as string) || initialReqPayload;

  const {
    loading,
    error,
    activeRequest,
    timeRemaining,
    executionResult,
    isExpired,
    resolvePaymentRequest,
    handlePaymentConsent,
  } = usePaymentRequest();

  const { selectedWallet, sendPayment, loading: walletLoading } = useWallet();

  const [pin, setPin] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [denied, setDenied] = useState(false);

  React.useEffect(() => {
    if (payloadToResolve) {
      resolvePaymentRequest(payloadToResolve);
    }
  }, [payloadToResolve, resolvePaymentRequest]);

  // Handle consent rejection
  const onDenyConsent = async () => {
    setDenied(true);
    if (activeRequest && selectedWallet) {
      await handlePaymentConsent(selectedWallet.publicKey, false);
    }
  };

  // Handle consent approval & payment submission
  const onApproveConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest || !selectedWallet) return;

    try {
      // 1. Authorize consent decision with backend
      const authResult = await handlePaymentConsent(selectedWallet.publicKey, true);
      if (!authResult.success) {
        return;
      }

      // 2. Perform on-chain payment transfer via wallet service
      const idempotencyKey = `idemp_req_${activeRequest.id}_${Date.now()}`;
      await sendPayment(
        pin,
        {
          sourcePublicKey: selectedWallet.publicKey,
          destination: activeRequest.destination,
          amount: activeRequest.amount,
          asset: activeRequest.asset,
          memo: activeRequest.memo,
        },
        idempotencyKey
      );

      setPinModalOpen(false);
      setPin('');
    } catch {
      // Errors handled in hook or wallet
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Payment Request | PetChain</title>
        <meta name="description" content="Review and pay a requested asset transfer securely on Stellar" />
      </Head>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl sm:px-10 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 id="pay-request-title" className="text-xl font-bold text-gray-900">
              Payment Request
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Verify the requested asset and destination before authorising payment.
            </p>
          </div>

          {loading && !activeRequest && (
            <div className="flex flex-col items-center justify-center py-12" role="status">
              <Loader2 className="animate-spin text-blue-600 mb-2" size={32} aria-hidden="true" />
              <p className="text-xs text-gray-500">Resolving payment request...</p>
            </div>
          )}

          {error && !activeRequest && (
            <div
              role="alert"
              className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-3"
            >
              <AlertTriangle size={20} className="shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
              <div>
                <p className="font-semibold">Invalid or Inaccessible Link</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Expired State */}
          {activeRequest && (isExpired || activeRequest.status === 'expired') && (
            <div className="text-center py-6" role="alert">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                <Clock size={24} />
              </div>
              <h2 className="text-base font-bold text-gray-900">Payment Request Expired</h2>
              <p className="text-xs text-gray-500 mt-2">
                This request link expired at {new Date(activeRequest.expiresAt).toLocaleTimeString()}.
                Please ask the recipient to generate a fresh payment request.
              </p>
            </div>
          )}

          {/* Success State */}
          {executionResult?.success && (
            <div className="text-center py-6" role="status">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-base font-bold text-gray-900">Payment Completed</h2>
              <p className="text-xs text-gray-500 mt-2">
                {activeRequest?.amount} {activeRequest?.asset} has been sent.
              </p>
              {executionResult.transactionHash && (
                <p className="mt-2 text-xs font-mono text-gray-400 truncate">
                  Hash: {executionResult.transactionHash}
                </p>
              )}
            </div>
          )}

          {/* Denied State */}
          {denied && (
            <div className="text-center py-6" role="status">
              <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                <XCircle size={24} />
              </div>
              <h2 className="text-base font-bold text-gray-900">Payment Denied</h2>
              <p className="text-xs text-gray-500 mt-1">
                You declined this payment request. No funds were transferred.
              </p>
            </div>
          )}

          {/* Active Request Review Form */}
          {activeRequest && !isExpired && activeRequest.status !== 'expired' && !executionResult?.success && !denied && (
            <div className="space-y-6" aria-labelledby="pay-request-title">
              {/* Expiry Banner */}
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock size={14} aria-hidden="true" />
                  Time remaining:
                </span>
                <span className="font-bold">{timeRemaining}</span>
              </div>

              {/* Amount Display */}
              <div className="text-center py-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount Due</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">
                  {activeRequest.amount}{' '}
                  <span className="text-base font-semibold text-blue-600">{activeRequest.asset}</span>
                </p>
                {activeRequest.note && (
                  <p className="mt-2 text-xs text-gray-500 italic max-w-xs mx-auto">
                    "{activeRequest.note}"
                  </p>
                )}
              </div>

              {/* Recipient Details */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-gray-600 py-1 border-b border-gray-100">
                  <span className="font-medium">Recipient Address:</span>
                  <span
                    className="font-mono text-gray-800 truncate max-w-[200px]"
                    title={activeRequest.destination}
                  >
                    {activeRequest.destination}
                  </span>
                </div>
                {activeRequest.memo && (
                  <div className="flex justify-between items-center text-gray-600 py-1 border-b border-gray-100">
                    <span className="font-medium">Memo:</span>
                    <span className="text-gray-800 font-mono">{activeRequest.memo}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-gray-600 py-1">
                  <span className="font-medium">Privacy & Security:</span>
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <Lock size={12} aria-hidden="true" /> Secret keys withheld
                  </span>
                </div>
              </div>

              {/* Consent Decision Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onDenyConsent}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-gray-400"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => setPinModalOpen(true)}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Approve & Pay
                </button>
              </div>
            </div>
          )}

          {/* PIN Confirmation Modal */}
          {pinModalOpen && activeRequest && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-pin-title"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            >
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100">
                <h3 id="confirm-pin-title" className="text-base font-bold text-gray-900 mb-2">
                  Confirm Payment with Wallet PIN
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Authorize payment of {activeRequest.amount} {activeRequest.asset} to{' '}
                  <span className="font-mono">{activeRequest.destination.substring(0, 8)}...</span>
                </p>

                <form onSubmit={onApproveConsent} className="space-y-4">
                  <div>
                    <label htmlFor="auth-pin" className="block text-xs font-semibold text-gray-700 mb-1">
                      Wallet PIN
                    </label>
                    <input
                      id="auth-pin"
                      type="password"
                      maxLength={8}
                      placeholder="Enter PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                      autoFocus
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-center tracking-widest text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPinModalOpen(false)}
                      className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || walletLoading || !pin}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                    >
                      {loading || walletLoading ? 'Authorizing...' : 'Confirm'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentRequestView;
