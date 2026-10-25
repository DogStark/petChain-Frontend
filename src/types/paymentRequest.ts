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
