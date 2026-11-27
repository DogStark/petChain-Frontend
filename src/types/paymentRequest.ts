/**
 * Payment Request Types
 */

export interface PaymentRequest {
  id: string;
  asset: string;
  amount: string;
  destination: string;
  memo?: string;
  memoType?: 'text' | 'id' | 'hash';
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'completed' | 'cancelled';
  note?: string;
  createdByName?: string;
}

export interface CreatePaymentRequestInput {
  asset: string;
  amount: string;
  destination: string;
  memo?: string;
  memoType?: 'text' | 'id' | 'hash';
  /** Expiry in minutes from now. e.g. 15, 60, 1440 (24h), 10080 (7d) */
  expiresInMinutes: number;
  note?: string;
}

/**
 * A vet/clinic service line item included in a payment request.
 */
export interface VetServiceLineItem {
  /** Service name, e.g. "Vaccination". */
  name: string;
  /** Quantity of the service. Defaults to 1. */
  quantity?: number;
  /** Unit price in the request asset. */
  unitPrice: string;
}

/**
 * Input for generating a vet/clinic payment request.
 */
export interface VetServicePaymentRequestInput {
  /** Stellar public key (G...) of the vet/clinic receiving the funds. */
  destination: string;
  /** Asset code, e.g. XLM, USDC. */
  asset: string;
  /** Total amount to request. */
  amount: string;
  /** Optional Stellar memo (max 28 characters). */
  memo?: string;
  /** Optional public note / reference shown to the payer. */
  note?: string;
  /** Expiry in minutes from now. */
  expiresInMinutes: number;
  /** Optional vet/clinic identifier the request belongs to. */
  clinicId?: string;
  /** Optional service line items backing the amount. */
  services?: VetServiceLineItem[];
}

/**
 * Result of generating a vet/clinic payment request, including the
 * shareable link and the QR code payload.
 */
export interface VetServicePaymentRequestResult {
  request: PaymentRequest;
  /** Shareable payment link. */
  shareableUrl: string;
  /** Value to encode in the QR code (the shareable link). */
  qrValue: string;
}

export interface PaymentRequestPayload {
  v: number; // schema version e.g. 1
  id: string;
  ast: string; // asset
  amt: string; // amount
  dst: string; // destination public key (NEVER private key)
  exp: number; // expiry timestamp in ms
  iat: number; // issued at timestamp in ms
  mem?: string; // memo
  mty?: 'text' | 'id' | 'hash'; // memo type
  not?: string; // public note/memo label
}
