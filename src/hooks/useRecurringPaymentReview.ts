/**
 * useRecurringPaymentReview hook
 *
 * Provides state management and backend synchronization for inspecting upcoming
 * recurring payment intents, next execution time, spending cap, and cancellation status
 * before a transaction is signed.
 *
 * Privacy by default:
 * - Addresses and amounts are strictly sanitized and never leaked to unauthenticated logs.
 * - Sensitive transaction values can be masked in the UI.
 *
 * Authorization & Consent:
 * - Owned by backend; hook exposes cancel, verify, grant, and deny operations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  RecurringPaymentIntent,
} from '../types/recurringPayment';
import { recurringPaymentAPI } from '../lib/api/recurringPaymentAPI';
import { useAnnouncement } from './useAnnouncement';

export interface UseRecurringPaymentReviewProps {
  sourcePublicKey?: string;
  initialIntents?: RecurringPaymentIntent[];
  autoFetch?: boolean;
}

export interface UseRecurringPaymentReviewResult {
  intents: RecurringPaymentIntent[];
  selectedIntent: RecurringPaymentIntent | null;
  loading: boolean;
  actionInProgress: boolean;
  error: string | null;
  privacyMask: boolean;
  togglePrivacyMask: () => void;
  selectIntent: (intent: RecurringPaymentIntent | null) => void;
  fetchIntents: () => Promise<void>;
  cancelIntent: (intentId: string, reason?: string) => Promise<boolean>;
  recordConsent: (intentId: string, action: 'grant' | 'deny') => Promise<boolean>;
  clearError: () => void;
}

export function useRecurringPaymentReview({
  sourcePublicKey,
  initialIntents = [],
  autoFetch = true,
}: UseRecurringPaymentReviewProps = {}): UseRecurringPaymentReviewResult {
  const [intents, setIntents] = useState<RecurringPaymentIntent[]>(initialIntents);
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(
    initialIntents[0]?.id ?? null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyMask, setPrivacyMask] = useState<boolean>(false);

  const { announce } = useAnnouncement();
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const togglePrivacyMask = useCallback(() => {
    setPrivacyMask((prev) => {
      const next = !prev;
      announce(next ? 'Sensitive payment details masked' : 'Sensitive payment details revealed');
      return next;
    });
  }, [announce]);

  const selectIntent = useCallback((intent: RecurringPaymentIntent | null) => {
    setSelectedIntentId(intent ? intent.id : null);
    if (intent) {
      announce(`Selected recurring payment intent for ${intent.recipientLabel || intent.destinationAddress}`);
    }
  }, [announce]);

  const fetchIntents = useCallback(async () => {
    if (!sourcePublicKey) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await recurringPaymentAPI.getRecurringIntents(sourcePublicKey);
      if (isMountedRef.current) {
        setIntents(data);
        if (data.length > 0 && !selectedIntentId) {
          setSelectedIntentId(data[0].id);
        }
        announce(`Loaded ${data.length} recurring payment ${data.length === 1 ? 'intent' : 'intents'}`);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const message = err instanceof Error ? err.message : 'Failed to fetch recurring payment intents';
        setError(message);
        announce(`Error loading recurring payment intents: ${message}`, 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [sourcePublicKey, selectedIntentId, announce]);

  useEffect(() => {
    if (autoFetch && sourcePublicKey) {
      void fetchIntents();
    }
  }, [autoFetch, sourcePublicKey, fetchIntents]);

  const cancelIntent = useCallback(
    async (intentId: string, reason?: string): Promise<boolean> => {
      setActionInProgress(true);
      setError(null);
      try {
        const result = await recurringPaymentAPI.cancelRecurringIntent(intentId, reason);
        if (result.success && isMountedRef.current) {
          setIntents((prev) =>
            prev.map((item) =>
              item.id === intentId
                ? {
                    ...item,
                    status: 'cancelled' as const,
                    statusReason: reason || 'Cancelled by user prior to signing',
                  }
                : item
            )
          );
          announce('Recurring payment intent successfully cancelled');
          return true;
        }
        return false;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          const message = err instanceof Error ? err.message : 'Failed to cancel recurring intent';
          setError(message);
          announce(`Cancellation failed: ${message}`, 'error');
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setActionInProgress(false);
        }
      }
    },
    [announce]
  );

  const recordConsent = useCallback(
    async (intentId: string, action: 'grant' | 'deny'): Promise<boolean> => {
      setActionInProgress(true);
      setError(null);
      try {
        const result = await recurringPaymentAPI.recordConsentDecision(intentId, action);
        if (result.success && isMountedRef.current) {
          setIntents((prev) =>
            prev.map((item) => (item.id === intentId ? result.intent : item))
          );
          const feedback =
            action === 'grant'
              ? 'Consent recorded. Intent authorized by backend.'
              : 'Consent denied. Intent blocked on backend.';
          announce(feedback);
          return true;
        }
        return false;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          const message = err instanceof Error ? err.message : 'Backend consent decision failed';
          setError(message);
          announce(`Consent update failed: ${message}`, 'error');
        }
        return false;
      } finally {
        if (isMountedRef.current) {
          setActionInProgress(false);
        }
      }
    },
    [announce]
  );

  const selectedIntent = intents.find((i) => i.id === selectedIntentId) || null;

  return {
    intents,
    selectedIntent,
    loading,
    actionInProgress,
    error,
    privacyMask,
    togglePrivacyMask,
    selectIntent,
    fetchIntents,
    cancelIntent,
    recordConsent,
    clearError,
  };
}
