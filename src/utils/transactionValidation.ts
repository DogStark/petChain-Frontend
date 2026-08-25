/**
 * Pre-signing validation for Stellar transactions.
 *
 * The signing flow handles irreversible transfers, so malformed destinations,
 * unsafe amounts, and ambiguous memos must be rejected before a transaction is
 * built or signed. This module keeps that logic pure and unit-testable.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { amountToStroopsOrNull, compareStellarAmounts } from './stellarAmounts';

/** Maximum byte length of a Stellar `Memo.text` (28 bytes, not 28 characters). */
export const MAX_MEMO_BYTES = 28;

/** Control characters (C0 + DEL) are not valid in human-readable memos. */
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

/**
 * A 64-character hex string is exactly the shape of a Stellar `Memo.hash`.
 * Text memos are truncated silently, so accepting it as text would be ambiguous
 * and could mislead the receiver about the intended memo.
 */
const MEMO_HASH_PATTERN = /^[0-9a-fA-F]{64}$/;

export interface TransactionValidationInput {
  destination: string;
  amount: string;
  memo?: string;
  /** Available balance as a canonical decimal string; used for sufficiency checks. */
  maxAmount?: string;
  /** The sender's own public key; sending to yourself is rejected. */
  sourcePublicKey?: string;
}

/**
 * Returns true when `address` is a structurally valid Stellar ed25519 public
 * key (G...). Uses the official Stellar SDK strkey decoder.
 */
export function isValidStellarAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (trimmed === '') return false;
  // Reject surrounding whitespace so the exact signed destination is unambiguous.
  if (trimmed !== address) return false;
  return StellarSdk.StrKey.isValidEd25519PublicKey(trimmed);
}

/** Returns the UTF-8 byte length of a memo string (Stellar memo limits are byte-based). */
export function memoByteLength(memo: string): number {
  return new TextEncoder().encode(memo).length;
}

/**
 * Validates a memo for the signing flow.
 * Returns an error message, or null when the memo is acceptable (including empty).
 */
export function validateMemo(memo: string): string | null {
  if (!memo) return null;

  if (CONTROL_CHAR_PATTERN.test(memo)) {
    return 'Memo contains unsupported control characters.';
  }
  if (memo.trim() !== memo) {
    return 'Memo cannot start or end with whitespace.';
  }
  if (MEMO_HASH_PATTERN.test(memo)) {
    return 'Memo looks like a 64-character hash. Use a short descriptive text instead.';
  }

  const bytes = memoByteLength(memo);
  if (bytes > MAX_MEMO_BYTES) {
    return `Memo must be 28 bytes or fewer (current: ${bytes} bytes).`;
  }

  return null;
}

/**
 * Validates a full payment intent before signing.
 * Returns an error message, or null when the input may be signed.
 */
export function validateTransactionInput(input: TransactionValidationInput): string | null {
  const { destination, amount, memo } = input;

  if (!destination || !destination.trim()) {
    return 'Destination address is required.';
  }
  if (!isValidStellarAddress(destination)) {
    return 'Invalid destination — must be a valid Stellar public key (G...).';
  }
  if (input.sourcePublicKey && destination === input.sourcePublicKey) {
    return 'Cannot send to your own address.';
  }

  if (!amount) {
    return 'Enter a valid positive amount.';
  }
  const amountStroops = amountToStroopsOrNull(amount);
  if (amountStroops === null) {
    return 'Amount must be a decimal number with up to 7 decimal places.';
  }

  if (input.maxAmount !== undefined) {
    const maxStroops = amountToStroopsOrNull(input.maxAmount);
    if (maxStroops !== null && amountStroops > maxStroops) {
      return `Insufficient balance. Available: ${input.maxAmount}`;
    }
  }

  const memoError = validateMemo(memo ?? '');
  if (memoError) return memoError;

  return null;
}

/** Convenience guard used by amount/balance comparisons in UI paths. */
export function amountExceeds(amount: string, maxAmount: string): boolean {
  try {
    return compareStellarAmounts(amount, maxAmount) > 0;
  } catch {
    return false;
  }
}
