import { useState, useCallback, useRef } from 'react';
import {
  transactionAPI,
  Transaction,
  TransactionType,
  TransactionFilters,
  EstimateData,
  CursorPage,
  CursorPaginationParams,
} from '@/lib/api/transactionAPI';
import {
  generateIdempotencyKey,
  samePayload,
  IDEMPOTENCY_HEADER,
  type IdempotencyPayload,
} from '@/utils/idempotencyKey';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Payload shape for a send-payment submission.  Mirrors the fields sent to the
 * wallet layer and used to derive a deterministic idempotency key.
 */
export interface SendPaymentPayload {
  sourcePublicKey: string;
  destination: string;
  amount: string;
  asset: string;
  memo?: string;
  fee?: string;
}

/** Internal record of a submission that is currently in-flight. */
interface PendingSubmission {
  /** The idempotency key generated for this request. */
  idempotencyKey: string;
  /** The payload digest (from the key) for fast same-payload checks. */
  payload: SendPaymentPayload;
  /** Timestamp when the submission was initiated (ms). */
  startedAt: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pending, setPending] = useState<Transaction[]>([]);
  const [failed, setFailed] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * True while a send-payment submission is in-flight.  Using a ref instead
   * of state prevents the guard from causing an extra render cycle and avoids
   * the stale-closure problem in the submit handler.
   */
  const submittingRef = useRef(false);

  /**
   * Queue of in-flight submissions.  Kept in a ref so comparisons don't
   * depend on stale state snapshots.
   */
  const pendingSubmissionsRef = useRef<PendingSubmission[]>([]);

  // ── Internal helpers ────────────────────────────────────────────────────

  /**
   * Return true if there is already an active submission for the same payload
   * (same destination + amount + asset + memo + fee).  This catches the case
   * where the user rapidly clicks "Send" multiple times with identical data.
   */
  function isDuplicateSubmission(payload: SendPaymentPayload): boolean {
    if (pendingSubmissionsRef.current.length === 0) return false;

    // Build a temporary sync key for the new payload so we can compare digests.
    // We only care about the digest portion, not the nonce.
    const candidateKey = `idempotency:0:${_fnv32aPayload(payload)}`;
    return pendingSubmissionsRef.current.some((ps) => {
      const existingKey = `idempotency:0:${_fnv32aPayload(ps.payload)}`;
      return samePayload(candidateKey, existingKey);
    });
  }

  /** Lightweight FNV-32a over the canonical payload fields for sync dedup. */
  function _fnv32aPayload(payload: SendPaymentPayload): string {
    const canonical = JSON.stringify({
      amount: parseFloat(payload.amount).toFixed(7),
      asset: payload.asset.trim().toUpperCase(),
      destination: payload.destination.trim(),
      fee: (payload.fee ?? '').trim(),
      memo: (payload.memo ?? '').trim(),
      sourcePublicKey: payload.sourcePublicKey.trim(),
    });
    let hash = 0x811c9dc5;
    for (let i = 0; i < canonical.length; i++) {
      hash ^= canonical.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  /**
   * Build the request headers for a submission, attaching the idempotency key.
   * The key is sent via the `Idempotency-Key` header so the backend can detect
   * duplicate submissions on retry.
   */
  function buildSubmissionHeaders(idempotencyKey: string): Record<string, string> {
    return { [IDEMPOTENCY_HEADER]: idempotencyKey };
  }

  /**
   * Reconcile pending submissions list against the server's pending list.
   * Removes submissions whose matching transaction has already been accepted
   * (i.e. it appears in the server's pending/confirmed list), preventing
   * stale in-flight records from blocking legitimate future submissions.
   *
   * Called automatically after `fetchPendingTransactions`.
   */
  function reconcilePendingSubmissions(serverPending: Transaction[]): void {
    if (pendingSubmissionsRef.current.length === 0) return;

    // Keep submissions that do NOT yet appear on the server.
    // A submission is "accepted" if we find a transaction from the same source
    // address that is in pending/confirmed state and was created after the
    // submission started.
    pendingSubmissionsRef.current = pendingSubmissionsRef.current.filter((ps) => {
      const serverMatch = serverPending.find(
        (tx) =>
          tx.fromAddress === ps.payload.sourcePublicKey &&
          tx.amount === ps.payload.amount &&
          (tx.toAddress ?? '') === ps.payload.destination &&
          new Date(tx.timestamp).getTime() >= ps.startedAt
      );
      return serverMatch === undefined; // keep if not yet confirmed
    });
  }

  // ── Read operations ─────────────────────────────────────────────────────

  const fetchTransactions = useCallback(async (filters?: TransactionFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await transactionAPI.getTransactionHistory(filters);
      setTransactions(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch a single cursor page of transaction history. Returns the page so
   * callers (e.g. `useCursorPagination`) can read the cursor metadata.
   */
  const fetchTransactionPage = useCallback(
    async (
      filters?: TransactionFilters,
      pagination?: CursorPaginationParams
    ): Promise<CursorPage<Transaction>> => {
      setLoading(true);
      setError(null);
      try {
        const page = await transactionAPI.getTransactionHistoryPage(filters, pagination);
        setTransactions(page.items);
        return page;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getTransaction = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      return await transactionAPI.getTransactionById(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transaction');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTransactionReceipt = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      return await transactionAPI.getTransactionReceipt(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch receipt');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTransactionCost = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      return await transactionAPI.getTransactionCost(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cost');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Write operations ─────────────────────────────────────────────────────

  const retryTransaction = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await transactionAPI.retryFailedTransaction(id);
      setTransactions((prev) => prev.map((tx) => (tx.id === id ? result : tx)));
      setFailed((prev) => prev.filter((tx) => tx.id !== id));
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry transaction');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelTransaction = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await transactionAPI.cancelPendingTransaction(id);
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      setPending((prev) => prev.filter((tx) => tx.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel transaction');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const estimateCost = useCallback(async (type: TransactionType, data?: EstimateData) => {
    setLoading(true);
    setError(null);
    try {
      return await transactionAPI.estimateTransactionCost(type, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate cost');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await transactionAPI.getPendingTransactions();
      setPending(data);
      // Reconcile: remove in-flight submissions that the server has accepted.
      reconcilePendingSubmissions(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pending transactions');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Submit a send-payment transaction with idempotency protection.
   *
   * - Generates a fresh idempotency key per attempt.
   * - Attaches the key via the `Idempotency-Key` request header.
   * - Detects duplicate submissions of the same payload and reuses the
   *   in-flight key so a retry is treated as the same attempt.
   */
  const submitSendPayment = useCallback(
    async (payload: SendPaymentPayload): Promise<Transaction> => {
      if (submittingRef.current) {
        throw new Error('A transaction submission is already in progress');
      }

      // Duplicate detection: reuse the existing key for the same payload.
      const existing = pendingSubmissionsRef.current.find((ps) =>
        samePayload(
          `idempotency:0:${_fnv32aPayload(payload)}`,
          `idempotency:0:${_fnv32aPayload(ps.payload)}`
        )
      );

      const idempotencyKey = existing
        ? existing.idempotencyKey
        : generateIdempotencyKey(payload as IdempotencyPayload).key;

      if (!existing) {
        pendingSubmissionsRef.current.push({
          idempotencyKey,
          payload,
          startedAt: Date.now(),
        });
      }

      submittingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const result = await transactionAPI.submitTransaction(payload, {
          headers: buildSubmissionHeaders(idempotencyKey),
        });
        setTransactions((prev) => [result, ...prev]);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit transaction');
        throw err;
      } finally {
        submittingRef.current = false;
        setLoading(false);
      }
    },
    []
  );

  return {
    transactions,
    pending,
    failed,
    loading,
    error,
    fetchTransactions,
    fetchTransactionPage,
    getTransaction,
    getTransactionReceipt,
    getTransactionCost,
    retryTransaction,
    cancelTransaction,
    estimateCost,
    fetchPendingTransactions,
    submitSendPayment,
  };
}
