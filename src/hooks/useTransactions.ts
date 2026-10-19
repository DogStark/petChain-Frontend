import { useState, useCallback, useRef } from 'react';
import {
  transactionAPI,
  Transaction,
  TransactionType,
  TransactionFilters,
  EstimateData,
} from '@/lib/api/transactionAPI';
import {
  generateIdempotencyKey,
  samePayload,
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
      // Reconcile: remove in-flight records that the server already knows about.
      reconcilePendingSubmissions(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pending transactions');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFailedTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await transactionAPI.getFailedTransactions();
      setFailed(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch failed transactions');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTotalCosts = useCallback(async (startDate?: string, endDate?: string) => {
    setLoading(true);
    setError(null);
    try {
      return await transactionAPI.getTotalCosts(startDate, endDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch costs');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Submit payment with idempotency guard ────────────────────────────────

  /**
   * Submit a payment transaction with full duplicate-submission protection:
   *
   * 1. **In-flight ref guard** – if `submittingRef.current` is already `true`
   *    the call returns immediately with `{ duplicate: true }`.  This blocks
   *    concurrent executions (e.g. rapid double-clicks) at the JS layer.
   *
   * 2. **Payload dedup** – `isDuplicateSubmission` checks whether an identical
   *    payload is already in-flight via `pendingSubmissionsRef`.  Two calls
   *    with the same `(source, destination, amount, asset, memo, fee)` while
   *    the first is still awaiting a response will be collapsed into one.
   *
   * 3. **Idempotency key** – a SHA-256-derived key is generated from the
   *    canonical payload and forwarded as the `Idempotency-Key` HTTP header so
   *    the backend can de-duplicate at the network level.
   *
   * @returns The idempotency key that was used, so the caller can surface it
   *          for debugging or store it alongside the result.
   */
  const submitPayment = useCallback(
    async (
      payload: SendPaymentPayload,
      /** Async function that actually sends the payment, called only when the
       *  submission is not a duplicate.  Receives the generated idempotency key
       *  so it can attach it to its own request (e.g. wallet signing layer). */
      sender: (idempotencyKey: string) => Promise<void>
    ): Promise<{ idempotencyKey: string; skipped: boolean }> => {
      // ── Guard 1: in-flight mutex ──────────────────────────────────────────
      if (submittingRef.current) {
        return { idempotencyKey: '', skipped: true };
      }

      // ── Guard 2: same-payload dedup ───────────────────────────────────────
      if (isDuplicateSubmission(payload)) {
        return { idempotencyKey: '', skipped: true };
      }

      // ── Generate idempotency key ──────────────────────────────────────────
      const idpPayload: IdempotencyPayload = {
        sourcePublicKey: payload.sourcePublicKey,
        destination: payload.destination,
        amount: payload.amount,
        asset: payload.asset,
        memo: payload.memo,
        fee: payload.fee,
      };
      const idempotencyKey = await generateIdempotencyKey(idpPayload);

      // ── Register in-flight submission ─────────────────────────────────────
      submittingRef.current = true;
      const submission: PendingSubmission = {
        idempotencyKey,
        payload,
        startedAt: Date.now(),
      };
      pendingSubmissionsRef.current = [...pendingSubmissionsRef.current, submission];

      try {
        setError(null);
        await sender(idempotencyKey);
        return { idempotencyKey, skipped: false };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transaction failed');
        throw err;
      } finally {
        // ── Release guards ────────────────────────────────────────────────
        submittingRef.current = false;
        pendingSubmissionsRef.current = pendingSubmissionsRef.current.filter(
          (ps) => ps.idempotencyKey !== idempotencyKey
        );
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Exposed state derived from refs ──────────────────────────────────────

  /** Whether any send-payment call is currently in-flight. */
  const isSubmitting = submittingRef.current;

  return {
    // State
    transactions,
    pending,
    failed,
    loading,
    error,
    isSubmitting,
    // Actions
    fetchTransactions,
    getTransaction,
    getTransactionReceipt,
    getTransactionCost,
    retryTransaction,
    cancelTransaction,
    estimateCost,
    fetchPendingTransactions,
    fetchFailedTransactions,
    getTotalCosts,
    submitPayment,
  };
}
