import { PaymentRequest, CreatePaymentRequestInput, PaymentRequestPayload } from '../types/paymentRequest';
import { isValidStellarAddress } from './transactionValidation';
import { isValidStellarAmount } from './stellarAmounts';

/**
 * Validates that an address is a valid Stellar public address (G...)
 * and specifically NOT a secret seed (S...).
 */
export function isSafePublicAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  // Reject secret keys immediately
  if (trimmed.startsWith('S') || trimmed.length !== 56) {
    return false;
  }
  return isValidStellarAddress(trimmed);
}

/**
 * Validates whether the amount is positive, valid numerical stellar format.
 */
export function isValidPaymentAmount(amount: string): boolean {
  if (!amount || typeof amount !== 'string') return false;
  const num = Number(amount);
  if (isNaN(num) || num <= 0) return false;
  return isValidStellarAmount(amount);
}

/**
 * Supported default assets for payment requests.
 */
export const SUPPORTED_PAYMENT_ASSETS = ['XLM', 'USDC', 'PET'] as const;

/**
 * Serializes a PaymentRequest into a base64url-encoded string payload.
 * Sensitive data or wallet secret keys are NEVER included.
 */
export function encodePaymentRequestPayload(req: PaymentRequest): string {
  // Defensive check: ensure destination is NOT a secret key
  if (req.destination.startsWith('S')) {
    throw new Error('Security Error: Cannot encode payment request with a secret key destination.');
  }

  const payload: PaymentRequestPayload = {
    v: 1,
    id: req.id,
    ast: req.asset.toUpperCase(),
    amt: req.amount,
    dst: req.destination.trim(),
    exp: new Date(req.expiresAt).getTime(),
    iat: new Date(req.createdAt).getTime(),
  };

  if (req.memo) payload.mem = req.memo;
  if (req.memoType) payload.mty = req.memoType;
  if (req.note) payload.not = req.note;

  const json = JSON.stringify(payload);
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window
      .btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  return Buffer.from(json, 'utf-8').toString('base64url');
}

/**
 * Decodes a base64url-encoded payload into a PaymentRequest.
 * Returns null if the payload is malformed or invalid.
 */
export function decodePaymentRequestPayload(encoded: string): PaymentRequest | null {
  if (!encoded || typeof encoded !== 'string') return null;

  try {
    let json = '';
    // Restore base64 padding and characters
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      json = decodeURIComponent(escape(window.atob(base64)));
    } else {
      json = Buffer.from(encoded, 'base64url').toString('utf-8');
    }

    const payload = JSON.parse(json) as PaymentRequestPayload;

    if (!payload || payload.v !== 1 || !payload.id || !payload.ast || !payload.amt || !payload.dst || !payload.exp) {
      return null;
    }

    // Safety check: ensure destination is safe
    if (!isSafePublicAddress(payload.dst)) {
      return null;
    }

    const now = Date.now();
    const isExpired = now >= payload.exp;

    return {
      id: payload.id,
      asset: payload.ast,
      amount: payload.amt,
      destination: payload.dst,
      memo: payload.mem,
      memoType: payload.mty,
      note: payload.not,
      createdAt: new Date(payload.iat).toISOString(),
      expiresAt: new Date(payload.exp).toISOString(),
      status: isExpired ? 'expired' : 'active',
    };
  } catch {
    return null;
  }
}

/**
 * Checks if a payment request is currently expired.
 */
export function isPaymentRequestExpired(req: Pick<PaymentRequest, 'expiresAt'>): boolean {
  if (!req?.expiresAt) return true;
  return Date.now() >= new Date(req.expiresAt).getTime();
}

/**
 * Formats time remaining until expiry in human-readable format.
 */
export function formatExpiryTimeRemaining(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return `${diffDays}d ${remHours}h remaining`;
  }
  if (diffHours > 0) {
    const remMin = diffMin % 60;
    return `${diffHours}h ${remMin}m remaining`;
  }
  if (diffMin > 0) {
    const remSec = diffSec % 60;
    return `${diffMin}m ${remSec}s remaining`;
  }
  return `${diffSec}s remaining`;
}

/**
 * Builds the full shareable URL for a payment request.
 */
export function buildPaymentRequestUrl(req: PaymentRequest, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const encoded = encodePaymentRequestPayload(req);
  return `${base}/pay/request?req=${encoded}`;
}
