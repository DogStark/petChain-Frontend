/**
 * Recurring Stellar Payment Intent types and interfaces.
 *
 * Scope:
 * Allows users to inspect upcoming recurring payment intents, next execution time,
 * spending cap, and cancellation status before a transaction is signed.
 *
 * Authorization and consent decisions are owned entirely by the backend.
 */

export type RecurringPaymentFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

export type RecurringPaymentStatus = 'active' | 'paused' | 'cancelled' | 'completed';

export interface RecurringPaymentIntent {
  id: string;
  /** Stellar account originating the recurring payments */
  sourcePublicKey: string;
  /** Stellar destination account */
  destinationAddress: string;
  /** Destination display name or memo if known */
  recipientLabel?: string;
  /** Amount per recurring execution (e.g. "15.0000000") */
  amount: string;
  /** Asset identifier, e.g. "XLM" or "USDC:GA5ZSEJYB37JRC5AV CIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" */
  asset: string;
  /** Frequency of recurring payment */
  frequency: RecurringPaymentFrequency;
  /** Maximum spending cap across the entire schedule (e.g. "150.0000000") */
  spendingCap: string;
  /** Amount already spent under this recurring schedule (e.g. "30.0000000") */
  currentSpent: string;
  /** Next scheduled execution timestamp (ISO-8601 string) */
  nextExecutionTime: string;
  /** Current status of the recurring payment intent */
  status: RecurringPaymentStatus;
  /** Date when schedule was created (ISO-8601 string) */
  createdAt: string;
  /** Optional transaction memo */
  memo?: string;
  /** Whether the user has authorized / given consent for this intent on the backend */
  backendAuthorized: boolean;
  /** Whether consent was explicitly denied by backend policy or user */
  consentDenied?: boolean;
  /** Optional denial or status reason returned by backend */
  statusReason?: string;
}

export interface RecurringPaymentReviewConsentResponse {
  success: boolean;
  intent: RecurringPaymentIntent;
  message?: string;
}

export interface RecurringPaymentCancellationResponse {
  success: boolean;
  intentId: string;
  cancelledAt: string;
  status: 'cancelled';
  message?: string;
}
