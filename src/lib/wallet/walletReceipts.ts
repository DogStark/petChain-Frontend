/**
 * Wallet Action Receipts
 *
 * Provides durable, audit-friendly records of wallet transactions.
 * Receipts survive browser refresh and handle failed/unknown transactions.
 * Sensitive signing material (PIN, secret keys, envelope XDR) is NEVER persisted.
 */

import { TransactionFinality, getFinality, getFinalityMeta } from '@/lib/transactionFinality';
import { getExplorerUrl } from '@/lib/blockchain/network';
import type { Transaction } from '@/lib/api/transactionAPI';
import type { WalletTransaction, BroadcastResult } from '@/types/wallet';

// ─── Types ──────────────────────────────────────────────────────────────────────

/** What the user intended to do (pre-submission). */
export interface WalletIntent {
  /** Human-readable description of the action. */
  action: 'send_payment' | 'multi_sig_setup' | 'multi_sig_remove_signer';
  /** Source wallet public key. */
  sourcePublicKey: string;
  /** Destination address (for payments). */
  destination?: string;
  /** Amount with asset (e.g., "50 XLM" or "100 USDC:GABC..."). */
  amountAsset?: string;
  /** Memo text if provided. */
  memo?: string;
  /** Fee level selected by user. */
  feeLevel?: 'base' | 'recommended' | 'high';
  /** Estimated fee in stroops. */
  estimatedFee?: string;
  /** Network used. */
  network: 'TESTNET' | 'PUBLIC';
  /** Unix timestamp (ms) when intent was created. */
  createdAt: number;
  /** Unique idempotency key for this submission attempt. */
  idempotencyKey: string;
}

/** What was actually submitted to the network. */
export interface SubmittedOperation {
  /** Transaction hash from the network (empty if submission failed before broadcast). */
  hash: string;
  /** Ledger sequence number (0 if not yet included). */
  ledger: number;
  /** Whether the submission was accepted by the network. */
  successful: boolean;
  /** Fee actually charged (stroops). */
  actualFee?: string;
  /** Unix timestamp (ms) when submission completed. */
  submittedAt: number;
  /** Optional error if submission failed. */
  error?: string;
}

/** Final on-chain status with guidance. */
export interface FinalStatus {
  /** Derived finality state. */
  finality: TransactionFinality;
  /** Human-readable label. */
  label: string;
  /** Actionable guidance for the user. */
  guidance: string;
  /** Tone for UI styling. */
  tone: 'neutral' | 'info' | 'success' | 'error' | 'warning';
  /** Number of confirmations (0 if unknown). */
  confirmations: number;
  /** Block number if confirmed. */
  blockNumber?: number;
  /** Unix timestamp (ms) when status was last updated. */
  updatedAt: number;
  /** Whether this status was derived from a conflict between sources. */
  isConflict: boolean;
}

/** Explorer link for verification. */
export interface ExplorerLink {
  /** Full URL to the transaction on the Stellar explorer. */
  url: string;
  /** Human-readable label. */
  label: string;
}

/** Complete receipt combining all phases. */
export interface WalletReceipt {
  /** Unique receipt ID (matches idempotency key). */
  id: string;
  /** What the user intended. */
  intent: WalletIntent;
  /** What was submitted to the network. */
  submitted: SubmittedOperation;
  /** Current final status (updated on refresh). */
  status: FinalStatus;
  /** Explorer link for verification. */
  explorer: ExplorerLink;
  /** Whether this receipt is for a multi-operation transaction. */
  isMultiOperation: boolean;
  /** If multi-operation, index of this operation (0-based). */
  operationIndex?: number;
  /** If multi-operation, total number of operations. */
  operationCount?: number;
  /** Parent receipt ID for multi-operation transactions. */
  parentReceiptId?: string;
}

/** Status update payload for refreshing receipts from the network. */
export interface ReceiptStatusUpdate {
  receiptId: string;
  status: FinalStatus;
  submitted?: Partial<SubmittedOperation>;
}

/** Options for creating a receipt. */
export interface CreateReceiptOptions {
  intent: WalletIntent;
  broadcastResult?: BroadcastResult;
  error?: Error;
  network: 'TESTNET' | 'PUBLIC';
  isMultiOperation?: boolean;
  operationIndex?: number;
  operationCount?: number;
  parentReceiptId?: string;
}

// ─── Receipt Creation ───────────────────────────────────────────────────────────

/**
 * Create a new wallet receipt from intent and broadcast result.
 * Called immediately after transaction submission (success or failure).
 */
export function createReceipt(options: CreateReceiptOptions): WalletReceipt {
  const {
    intent,
    broadcastResult,
    error,
    network,
    isMultiOperation = false,
    operationIndex,
    operationCount,
    parentReceiptId,
  } = options;

  const submitted: SubmittedOperation = {
    hash: broadcastResult?.hash ?? '',
    ledger: broadcastResult?.ledger ?? 0,
    successful: broadcastResult?.successful ?? false,
    actualFee: broadcastResult?.resultXdr ? 'unknown' : undefined, // We don't parse result XDR for fee
    submittedAt: Date.now(),
    error: error?.message,
  };

  // Create a mock transaction object to derive finality
  const mockTx: Transaction = {
    id: intent.idempotencyKey,
    hash: submitted.hash,
    type: 'transfer',
    status: submitted.successful ? 'pending' : 'failed',
    fromAddress: intent.sourcePublicKey,
    toAddress: intent.destination,
    amount: intent.amountAsset?.split(' ')[0],
    fee: submitted.actualFee ?? intent.estimatedFee ?? '0',
    timestamp: new Date(submitted.submittedAt).toISOString(),
    blockNumber: submitted.ledger || undefined,
    confirmations: submitted.ledger > 0 ? 1 : 0,
    errorMessage: submitted.error,
  };

  const finality = getFinality(mockTx);
  const meta = getFinalityMeta(finality);
  const status: FinalStatus = {
    finality,
    label: meta.label,
    guidance: meta.guidance,
    tone: meta.tone,
    confirmations: mockTx.confirmations,
    blockNumber: mockTx.blockNumber,
    updatedAt: Date.now(),
    isConflict: false,
  };

  const explorer: ExplorerLink = {
    url: getExplorerUrl(network),
    label: `View on Stellar ${network === 'TESTNET' ? 'Testnet' : 'Mainnet'} Explorer`,
  };

  if (submitted.hash) {
    explorer.url = `${explorer.url}/tx/${submitted.hash}`;
  }

  return {
    id: intent.idempotencyKey,
    intent,
    submitted,
    status,
    explorer,
    isMultiOperation,
    operationIndex,
    operationCount,
    parentReceiptId,
  };
}

/**
 * Update a receipt's status from a fresh network transaction.
 * Called when polling for transaction status.
 */
export function updateReceiptStatus(
  receipt: WalletReceipt,
  tx: Transaction
): WalletReceipt {
  const finality = getFinality(tx);
  const meta = getFinalityMeta(finality);
  const isConflict = receipt.status.isConflict;

  const status: FinalStatus = {
    finality,
    label: meta.label,
    guidance: meta.guidance,
    tone: meta.tone,
    confirmations: tx.confirmations,
    blockNumber: tx.blockNumber,
    updatedAt: Date.now(),
    isConflict,
  };

  const submitted: SubmittedOperation = {
    ...receipt.submitted,
    hash: tx.hash || receipt.submitted.hash,
    ledger: tx.blockNumber ?? receipt.submitted.ledger,
    successful: tx.status === 'confirmed' || tx.status === 'accepted',
    actualFee: tx.fee,
  };

  const explorer: ExplorerLink = {
    ...receipt.explorer,
    url: tx.hash ? `${getExplorerUrl(receipt.intent.network)}/tx/${tx.hash}` : receipt.explorer.url,
  };

  return {
    ...receipt,
    submitted,
    status,
    explorer,
  };
}

// ─── Receipt Filtering & Queries ────────────────────────────────────────────────

export type ReceiptFilter = {
  status?: TransactionFinality;
  network?: 'TESTNET' | 'PUBLIC';
  action?: WalletIntent['action'];
  sourcePublicKey?: string;
  fromDate?: number;
  toDate?: number;
  isMultiOperation?: boolean;
};

/** Filter receipts by criteria. */
export function filterReceipts(
  receipts: WalletReceipt[],
  filter: ReceiptFilter
): WalletReceipt[] {
  return receipts.filter((r) => {
    if (filter.status && r.status.finality !== filter.status) return false;
    if (filter.network && r.intent.network !== filter.network) return false;
    if (filter.action && r.intent.action !== filter.action) return false;
    if (filter.sourcePublicKey && r.intent.sourcePublicKey !== filter.sourcePublicKey) return false;
    if (filter.fromDate && r.intent.createdAt < filter.fromDate) return false;
    if (filter.toDate && r.intent.createdAt > filter.toDate) return false;
    if (filter.isMultiOperation !== undefined && r.isMultiOperation !== filter.isMultiOperation) return false;
    return true;
  });
}

/** Sort receipts: newest first, with pending/unknown at top for attention. */
export function sortReceipts(receipts: WalletReceipt[]): WalletReceipt[] {
  const statusOrder: Record<TransactionFinality, number> = {
    submitted: 0,
    accepted: 1,
    unknown: 2,
    confirmed: 3,
    failed: 4,
  };
  return [...receipts].sort((a, b) => {
    const aOrder = statusOrder[a.status.finality];
    const bOrder = statusOrder[b.status.finality];
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.intent.createdAt - a.intent.createdAt;
  });
}

/** Get receipts that need attention (pending, unknown, or failed). */
export function getAttentionReceipts(receipts: WalletReceipt[]): WalletReceipt[] {
  return receipts.filter(
    (r) => r.status.finality === 'submitted' || r.status.finality === 'unknown' || r.status.finality === 'failed'
  );
}

// ─── Multi-Operation Helpers ────────────────────────────────────────────────────

/** Group receipts by parentReceiptId for multi-operation display. */
export function groupMultiOperationReceipts(
  receipts: WalletReceipt[]
): Map<string, WalletReceipt[]> {
  const groups = new Map<string, WalletReceipt[]>();
  for (const receipt of receipts) {
    const key = receipt.parentReceiptId ?? receipt.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(receipt);
  }
  // Sort each group by operationIndex
  for (const group of groups.values()) {
    group.sort((a, b) => (a.operationIndex ?? 0) - (b.operationIndex ?? 0));
  }
  return groups;
}

/** Check if all operations in a multi-operation group are confirmed. */
export function isMultiOperationComplete(group: WalletReceipt[]): boolean {
  return group.every((r) => r.status.finality === 'confirmed');
}

/** Check if any operation in a multi-operation group has failed. */
export function hasMultiOperationFailure(group: WalletReceipt[]): boolean {
  return group.some((r) => r.status.finality === 'failed');
}

/** Get overall status for a multi-operation group. */
export function getMultiOperationStatus(group: WalletReceipt[]): FinalStatus {
  if (group.length === 0) {
    return getFinalityMeta('unknown');
  }
  if (hasMultiOperationFailure(group)) {
    return getFinalityMeta('failed');
  }
  if (isMultiOperationComplete(group)) {
    return getFinalityMeta('confirmed');
  }
  if (group.some((r) => r.status.finality === 'submitted')) {
    return getFinalityMeta('submitted');
  }
  if (group.some((r) => r.status.finality === 'accepted')) {
    return getFinalityMeta('accepted');
  }
  return getFinalityMeta('unknown');
}