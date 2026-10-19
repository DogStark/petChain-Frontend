/**
 * Receipt Service
 *
 * Manages durable persistence of wallet action confirmation receipts in localStorage.
 * Automatically strips any sensitive material (PINs, secret keys, passwords, seed phrases)
 * before persisting, satisfying the audit requirement that sensitive material is never stored.
 * Handles refresh recovery and query filters for successful, rejected, replaced, and multi-op flows.
 */

import {
  WalletReceipt,
  WalletIntent,
  CreateReceiptOptions,
  createReceipt,
  updateReceiptStatus,
  filterReceipts,
  sortReceipts,
  getAttentionReceipts,
  groupMultiOperationReceipts,
  ReceiptFilter,
} from './walletReceipts';
import type { Transaction } from '@/lib/api/transactionAPI';

const RECEIPT_STORAGE_KEY = 'petchain_wallet_receipts';

/**
 * Recursively strip any potential sensitive fields (PIN, secret, private key, seed, password)
 * from receipt objects before writing to storage or exposing.
 */
function sanitizeReceipt(receipt: WalletReceipt): WalletReceipt {
  const json = JSON.stringify(receipt, (key, value) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('pin') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('private') ||
      lowerKey.includes('seed') ||
      lowerKey.includes('password') ||
      lowerKey.includes('entropy') ||
      lowerKey.includes('encrypted')
    ) {
      return undefined;
    }
    return value;
  });
  return JSON.parse(json);
}

export class ReceiptService {
  /**
   * Save a receipt to durable localStorage after rigorous sanitization.
   */
  saveReceipt(receipt: WalletReceipt): WalletReceipt {
    const sanitized = sanitizeReceipt(receipt);
    const receipts = this.getReceipts();
    const index = receipts.findIndex((r) => r.id === sanitized.id);
    if (index >= 0) {
      receipts[index] = sanitized;
    } else {
      receipts.unshift(sanitized);
    }
    try {
      localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipts));
    } catch (error) {
      console.warn('Failed to persist wallet receipt to localStorage:', error);
    }
    return sanitized;
  }

  /**
   * Create and persist a new receipt from intent and broadcast results.
   */
  createAndSave(options: CreateReceiptOptions): WalletReceipt {
    const receipt = createReceipt(options);
    return this.saveReceipt(receipt);
  }

  /**
   * Retrieve all persisted receipts, sanitizing each on load.
   */
  getReceipts(): WalletReceipt[] {
    try {
      const raw = localStorage.getItem(RECEIPT_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(sanitizeReceipt);
    } catch (error) {
      console.warn('Failed to load wallet receipts from localStorage:', error);
      return [];
    }
  }

  /**
   * Get a specific receipt by ID or transaction hash.
   */
  getReceipt(idOrHash: string): WalletReceipt | null {
    const receipts = this.getReceipts();
    return (
      receipts.find((r) => r.id === idOrHash || r.submitted.hash === idOrHash) ?? null
    );
  }

  /**
   * Update an existing receipt's status and submitted details (e.g. after network poll).
   */
  updateReceipt(id: string, tx: Transaction): WalletReceipt | null {
    const receipts = this.getReceipts();
    const index = receipts.findIndex((r) => r.id === id || r.submitted.hash === tx.hash);
    if (index < 0) return null;

    const updated = updateReceiptStatus(receipts[index], tx);
    return this.saveReceipt(updated);
  }

  /**
   * Remove a receipt by ID.
   */
  deleteReceipt(id: string): void {
    const receipts = this.getReceipts().filter((r) => r.id !== id);
    try {
      localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipts));
    } catch (error) {
      console.warn('Failed to delete receipt from localStorage:', error);
    }
  }

  /**
   * Clear all stored receipts.
   */
  clearReceipts(): void {
    try {
      localStorage.removeItem(RECEIPT_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear receipts from localStorage:', error);
    }
  }

  /**
   * Query receipts with filtering and sorting.
   */
  query(filter?: ReceiptFilter): WalletReceipt[] {
    const receipts = this.getReceipts();
    const filtered = filter ? filterReceipts(receipts, filter) : receipts;
    return sortReceipts(filtered);
  }

  /**
   * Get receipts requiring user attention (pending, failed, unknown).
   */
  getAttentionRequired(): WalletReceipt[] {
    return getAttentionReceipts(this.getReceipts());
  }

  /**
   * Get receipts grouped by multi-operation parent ID.
   */
  getMultiOperationGroups(): Map<string, WalletReceipt[]> {
    return groupMultiOperationReceipts(this.getReceipts());
  }
}

export const receiptService = new ReceiptService();
