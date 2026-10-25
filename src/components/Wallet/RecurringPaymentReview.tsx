/**
 * RecurringPaymentReview component
 *
 * Scope:
 * Inspect upcoming recurring payment intents, next execution time, spending cap,
 * and cancellation status before a transaction is signed.
 *
 * Criteria:
 * - Owned authorization and consent decisions by backend.
 * - Handles primary flow, empty states, denied states, cancelled states.
 * - Privacy by default with mask/reveal toggle.
 * - Full keyboard & screen-reader accessibility (aria attributes, live regions, tab index).
 */

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Shield,
  ShieldAlert,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Ban,
  XCircle,
  RefreshCw,
  ArrowRight,
  Lock,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import type { RecurringPaymentIntent } from '../types/recurringPayment';
import { useRecurringPaymentReview } from '../hooks/useRecurringPaymentReview';

export interface RecurringPaymentReviewProps {
  sourcePublicKey: string;
  initialIntents?: RecurringPaymentIntent[];
  onProceedToSign?: (intent: RecurringPaymentIntent) => void;
  onClose?: () => void;
  isTestnet?: boolean;
}

export function maskAddress(address: string, mask: boolean): string {
  if (!address) return '';
  if (mask) return '••••••••••••••••••••••••••••••••••••••••••••••••••••••••';
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}…${address.slice(-8)}`;
}

export function maskAmount(amount: string, mask: boolean): string {
  if (mask) return '••••••';
  return amount;
}

export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoString;
  }
}

export default function RecurringPaymentReview({
  sourcePublicKey,
  initialIntents,
  onProceedToSign,
  onClose,
  isTestnet = false,
}: RecurringPaymentReviewProps) {
  const {
    intents,
    selectedIntent,
    loading,
    actionInProgress,
    error,
    privacyMask,
    togglePrivacyMask,
    selectIntent,
    fetchIntents,
    cancelIntent,
    recordConsent,
    clearError,
  } = useRecurringPaymentReview({
    sourcePublicKey,
    initialIntents,
    autoFetch: !initialIntents || initialIntents.length === 0,
  });

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const handleCancelClick = () => {
    setConfirmCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedIntent) return;
    const success = await cancelIntent(selectedIntent.id, cancelReason);
    if (success) {
      setConfirmCancelOpen(false);
      setCancelReason('');
    }
  };

  return (
    <div
      role="region"
      aria-labelledby="recurring-review-title"
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="border-b border-gray-100 bg-gray-50/70 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="recurring-review-title" className="text-lg font-bold text-gray-900">
              Recurring Stellar Payment Review
            </h2>
            {isTestnet && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
                Testnet
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Review upcoming payment schedules, execution limits, and consent status before signing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Privacy Toggle */}
          <button
            type="button"
            onClick={togglePrivacyMask}
            aria-pressed={privacyMask}
            aria-label={privacyMask ? 'Reveal sensitive payment details' : 'Mask sensitive payment details for privacy'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            {privacyMask ? (
              <>
                <EyeOff size={14} aria-hidden="true" className="text-gray-500" />
                <span>Masked</span>
              </>
            ) : (
              <>
                <Eye size={14} aria-hidden="true" className="text-gray-500" />
                <span>Privacy Mask</span>
              </>
            )}
          </button>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => void fetchIntents()}
            disabled={loading || actionInProgress}
            aria-label="Refresh recurring payment intents"
            className="p-1.5 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close recurring payment review"
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <XCircle size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Screen Reader Live Status / Error alerts */}
      <div className="p-4">
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="text-red-600 hover:text-red-800 text-xs font-semibold focus:outline-none focus:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && intents.length === 0 && (
          <div
            role="status"
            aria-live="polite"
            className="py-12 flex flex-col items-center justify-center text-gray-500 gap-3"
          >
            <RefreshCw size={24} className="animate-spin text-blue-600" aria-hidden="true" />
            <p className="text-sm">Loading recurring payment review details…</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && intents.length === 0 && (
          <div
            role="status"
            className="py-12 px-4 text-center border-2 border-dashed border-gray-200 rounded-xl my-2"
          >
            <Calendar size={36} className="mx-auto text-gray-400 mb-3" aria-hidden="true" />
            <h3 className="text-base font-semibold text-gray-900">No Recurring Payment Intents</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
              There are no upcoming recurring Stellar payment schedules configured for this wallet.
            </p>
          </div>
        )}

        {/* Intent List & Selected Details */}
        {intents.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List / Selection Column */}
            <div className="lg:col-span-1 border border-gray-200 rounded-xl p-3 bg-gray-50/50">
              <h3 id="intents-list-heading" className="text-xs font-bold uppercase text-gray-500 px-2 mb-2 tracking-wider">
                Upcoming Schedules ({intents.length})
              </h3>
              <ul
                role="listbox"
                aria-labelledby="intents-list-heading"
                className="space-y-2 max-h-96 overflow-y-auto"
              >
                {intents.map((intent) => {
                  const isSelected = selectedIntent?.id === intent.id;
                  const isCancelled = intent.status === 'cancelled';
                  const isDenied = intent.consentDenied || !intent.backendAuthorized;

                  return (
                    <li
                      key={intent.id}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => selectIntent(intent)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectIntent(intent);
                        }
                      }}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isSelected
                          ? 'bg-blue-50/90 border-blue-400 shadow-sm'
                          : 'bg-white border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-gray-900 truncate">
                          {intent.recipientLabel || maskAddress(intent.destinationAddress, privacyMask)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isCancelled
                              ? 'bg-red-100 text-red-800'
                              : isDenied
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {intent.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 flex justify-between items-center">
                        <span>
                          {maskAmount(intent.amount, privacyMask)} {intent.asset.split(':')[0]} / {intent.frequency}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                        <Clock size={11} aria-hidden="true" />
                        <span>Next: {formatDateTime(intent.nextExecutionTime)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Detailed Inspection Panel */}
            {selectedIntent && (
              <div
                className="lg:col-span-2 border border-gray-200 rounded-xl p-5 bg-white flex flex-col justify-between"
                aria-label={`Details for recurring intent ${selectedIntent.id}`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <span>{selectedIntent.recipientLabel || 'Recurring Payment Schedule'}</span>
                      </h3>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        Destination: {maskAddress(selectedIntent.destinationAddress, privacyMask)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedIntent.status === 'cancelled' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold bg-red-100 text-red-800">
                          <Ban size={13} aria-hidden="true" /> Cancelled
                        </span>
                      )}
                      {selectedIntent.consentDenied && (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-800">
                          <ShieldAlert size={13} aria-hidden="true" /> Consent Denied
                        </span>
                      )}
                      {selectedIntent.backendAuthorized && !selectedIntent.consentDenied && selectedIntent.status !== 'cancelled' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-800">
                          <CheckCircle size={13} aria-hidden="true" /> Backend Authorized
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Primary Review Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-500 font-medium block">Per-Execution Amount</span>
                      <span className="text-base font-bold text-gray-900 mt-0.5 block">
                        {maskAmount(selectedIntent.amount, privacyMask)} {selectedIntent.asset}
                      </span>
                      <span className="text-[11px] text-gray-400 mt-1 block">Frequency: {selectedIntent.frequency}</span>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-500 font-medium block">Spending Cap &amp; Usage</span>
                      <span className="text-base font-bold text-blue-700 mt-0.5 block">
                        Cap: {maskAmount(selectedIntent.spendingCap, privacyMask)} {selectedIntent.asset.split(':')[0]}
                      </span>
                      <span className="text-[11px] text-gray-500 mt-1 block">
                        Spent so far: {maskAmount(selectedIntent.currentSpent, privacyMask)} / {maskAmount(selectedIntent.spendingCap, privacyMask)}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-500 font-medium block">Next Execution Time</span>
                      <div className="flex items-center gap-1.5 mt-1 text-sm font-semibold text-gray-900">
                        <Calendar size={14} className="text-blue-600" aria-hidden="true" />
                        <time dateTime={selectedIntent.nextExecutionTime}>
                          {formatDateTime(selectedIntent.nextExecutionTime)}
                        </time>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-500 font-medium block">Backend Authorization</span>
                      <div className="flex items-center gap-1.5 mt-1 text-sm font-semibold">
                        {selectedIntent.backendAuthorized && !selectedIntent.consentDenied ? (
                          <span className="text-green-700 flex items-center gap-1">
                            <Shield size={14} aria-hidden="true" /> Verified &amp; Consented
                          </span>
                        ) : (
                          <span className="text-amber-700 flex items-center gap-1">
                            <ShieldAlert size={14} aria-hidden="true" /> Unconsented / Denied
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Warning banner if denied */}
                  {selectedIntent.consentDenied && (
                    <div
                      role="alert"
                      className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2"
                    >
                      <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <div>
                        <p className="font-semibold">Backend Consent Denied</p>
                        <p className="mt-0.5">
                          {selectedIntent.statusReason ||
                            'This recurring payment intent was rejected or denied by backend consent controls. Signing is blocked until consent is granted.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Cancellation status message if cancelled */}
                  {selectedIntent.status === 'cancelled' && (
                    <div
                      role="status"
                      className="mb-4 p-3 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-700 flex items-start gap-2"
                    >
                      <Ban size={15} className="text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <div>
                        <p className="font-semibold">Schedule Cancelled</p>
                        <p className="mt-0.5">
                          {selectedIntent.statusReason ||
                            'This recurring schedule has been cancelled. No future transactions will execute.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedIntent.memo && (
                    <div className="text-xs text-gray-600 mb-4 px-3 py-2 bg-gray-50 rounded-lg">
                      <span className="font-semibold text-gray-700">Memo: </span>
                      <span>{selectedIntent.memo}</span>
                    </div>
                  )}
                </div>

                {/* Cancellation Modal Dialog */}
                {confirmCancelOpen && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="cancel-dialog-title"
                    className="my-3 p-4 bg-red-50/70 border border-red-200 rounded-lg"
                  >
                    <h4 id="cancel-dialog-title" className="text-sm font-bold text-red-900">
                      Cancel Recurring Schedule
                    </h4>
                    <p className="text-xs text-red-700 mt-1">
                      Are you sure you want to cancel this recurring Stellar payment? This halts future scheduled executions before a transaction is signed.
                    </p>
                    <label htmlFor="cancel-reason" className="block text-xs font-medium text-gray-700 mt-2">
                      Cancellation Reason (Optional)
                    </label>
                    <input
                      id="cancel-reason"
                      type="text"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g. Service terminated, changed clinic, over budget"
                      className="mt-1 w-full text-xs px-3 py-1.5 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setConfirmCancelOpen(false)}
                        disabled={actionInProgress}
                        className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Keep Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleConfirmCancel()}
                        disabled={actionInProgress}
                        className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                      >
                        {actionInProgress ? 'Cancelling…' : 'Confirm Cancellation'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {selectedIntent.status !== 'cancelled' && !confirmCancelOpen && (
                      <button
                        type="button"
                        onClick={handleCancelClick}
                        disabled={actionInProgress}
                        aria-label={`Cancel recurring payment schedule ${selectedIntent.id}`}
                        className="px-3 py-2 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Cancel Recurring Schedule
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Consent Grant / Deny Buttons (backend owns decision) */}
                    {selectedIntent.status !== 'cancelled' && (
                      <>
                        {selectedIntent.consentDenied || !selectedIntent.backendAuthorized ? (
                          <button
                            type="button"
                            onClick={() => void recordConsent(selectedIntent.id, 'grant')}
                            disabled={actionInProgress}
                            aria-label="Grant backend consent for this recurring intent"
                            className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            Grant Backend Consent
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void recordConsent(selectedIntent.id, 'deny')}
                            disabled={actionInProgress}
                            aria-label="Revoke backend consent for this recurring intent"
                            className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            Deny Consent
                          </button>
                        )}
                      </>
                    )}

                    {/* Proceed to Sign Action */}
                    {onProceedToSign && (
                      <button
                        type="button"
                        onClick={() => onProceedToSign(selectedIntent)}
                        disabled={
                          actionInProgress ||
                          selectedIntent.status === 'cancelled' ||
                          selectedIntent.consentDenied ||
                          !selectedIntent.backendAuthorized
                        }
                        aria-label={`Proceed to sign transaction for schedule ${selectedIntent.id}`}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                      >
                        <span>Proceed to Sign</span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
