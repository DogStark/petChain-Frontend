import type { Transaction } from '@/lib/api/transactionAPI';

export type TransactionFinality = 'submitted' | 'accepted' | 'confirmed' | 'failed' | 'unknown';

export interface FinalityMeta {
  label: string;
  guidance: string;
  tone: 'neutral' | 'info' | 'success' | 'error' | 'warning';
}

/**
 * Distinct user guidance per finality. Keep copy short, actionable, no PII.
 */
export const FINALITY_META: Record<TransactionFinality, FinalityMeta> = {
  submitted: {
    label: 'Submitted',
    guidance:
      'Sent to the network — waiting for confirmation. Keep this window open. Verify hash on explorer if it stays here.',
    tone: 'warning',
  },
  accepted: {
    label: 'Accepted',
    guidance:
      'Accepted by the network and awaiting final confirmation. Usually final in seconds on Stellar — check explorer for ledger inclusion.',
    tone: 'info',
  },
  confirmed: {
    label: 'Confirmed',
    guidance: 'Confirmed and final on-chain. No action needed — record is anchored. See explorer for ledger details.',
    tone: 'success',
  },
  failed: {
    label: 'Failed',
    guidance: 'Transaction failed — it was not applied. Review the error, then retry. Check explorer for reason code if available.',
    tone: 'error',
  },
  unknown: {
    label: 'Unknown',
    guidance:
      'Status could not be determined from provider responses. Retry refresh or verify the hash on explorer before retrying.',
    tone: 'neutral',
  },
};

/**
 * Derive explicit finality from canonical transaction fields.
 * - failed/cancelled => failed (terminal)
 * - confirmed => confirmed (or accepted if confirmations < threshold — still confirmed status is authoritative)
 * - pending with 0 confirmations => submitted
 * - pending with >=1 confirmations or blockNumber => accepted
 * - otherwise => unknown (covers undefined status, negative confirmations, etc.)
 *
 * Exported as pure function for unit testing and display.
 */
export function getFinality(tx: Transaction): TransactionFinality {
  const status = (tx?.status || '').toLowerCase();
  const confirmations = typeof tx?.confirmations === 'number' ? tx.confirmations : 0;

  if (status === 'failed' || status === 'cancelled') return 'failed';
  if (status === 'confirmed') return 'confirmed';
  if (status === 'pending') {
    if (!Number.isFinite(confirmations) || confirmations < 0) return 'unknown';
    if (confirmations === 0 && !tx.blockNumber) return 'submitted';
    if (confirmations >= 1 || typeof tx.blockNumber === 'number') return 'accepted';
    return 'submitted';
  }
  return 'unknown';
}

export function getFinalityMeta(finality: TransactionFinality): FinalityMeta {
  return FINALITY_META[finality] ?? FINALITY_META.unknown;
}

/**
 * Reconcile two provider lists (pending / failed) into a single de-duplicated
 * list with conflict detection. A transaction that appears in both lists,
 * or whose status field contradicts the list it came from, is classified as
 * `unknown` with a conflict flag so the UI can give distinct guidance and
 * point the user to the explorer.
 */
export interface ReconciledTransaction {
  tx: Transaction;
  finality: TransactionFinality;
  isConflict: boolean;
  sources: ('pending' | 'failed')[];
}

export function reconcileTransactions(
  pending: Transaction[],
  failed: Transaction[]
): ReconciledTransaction[] {
  const map = new Map<string, { tx: Transaction; sources: Set<'pending' | 'failed'> }>();

  for (const tx of pending) {
    const entry = map.get(tx.id);
    if (entry) {
      entry.sources.add('pending');
      // keep first-seen tx as authoritative for display; mark conflict later
    } else {
      map.set(tx.id, { tx, sources: new Set(['pending']) });
    }
  }
  for (const tx of failed) {
    const entry = map.get(tx.id);
    if (entry) {
      entry.sources.add('failed');
    } else {
      map.set(tx.id, { tx, sources: new Set(['failed']) });
    }
  }

  const reconciled: ReconciledTransaction[] = [];
  for (const { tx, sources } of map.values()) {
    const sourceList = Array.from(sources) as ('pending' | 'failed')[];
    const appearsInBoth = sources.size > 1;
    const statusContradictsSource =
      (sources.has('pending') && tx.status === 'failed') ||
      (sources.has('failed') && tx.status === 'pending' && tx.confirmations === 0);

    const isConflict = appearsInBoth || statusContradictsSource;
    const baseFinality = getFinality(tx);
    const finality: TransactionFinality = isConflict ? 'unknown' : baseFinality;

    reconciled.push({ tx, finality, isConflict, sources: sourceList });
  }

  // Stable sort: submitted → accepted → confirmed → failed → unknown, then timestamp desc
  const order: Record<TransactionFinality, number> = {
    submitted: 0,
    accepted: 1,
    confirmed: 2,
    failed: 3,
    unknown: 4,
  };
  reconciled.sort((a, b) => {
    if (order[a.finality] !== order[b.finality]) return order[a.finality] - order[b.finality];
    return new Date(b.tx.timestamp).getTime() - new Date(a.tx.timestamp).getTime();
  });
  return reconciled;
}
