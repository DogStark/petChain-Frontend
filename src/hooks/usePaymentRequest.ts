import { useState, useCallback, useEffect, useRef } from 'react';
import { PaymentRequest, CreatePaymentRequestInput } from '@/types/paymentRequest';
import { paymentRequestAPI, PaymentExecutionResult } from '@/lib/api/paymentRequestAPI';
import {
  isSafePublicAddress,
  isValidPaymentAmount,
  isPaymentRequestExpired,
  formatExpiryTimeRemaining,
  buildPaymentRequestUrl,
} from '@/utils/paymentRequest';

export function usePaymentRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<PaymentRequest | null>(null);
  const [shareableUrl, setShareableUrl] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [executionResult, setExecutionResult] = useState<PaymentExecutionResult | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update time remaining tick
  useEffect(() => {
    if (!activeRequest) {
      setTimeRemaining('');
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const updateTimer = () => {
      const remaining = formatExpiryTimeRemaining(activeRequest.expiresAt);
      setTimeRemaining(remaining);
      if (isPaymentRequestExpired(activeRequest) && activeRequest.status === 'active') {
        setActiveRequest((prev) => (prev ? { ...prev, status: 'expired' } : null));
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeRequest]);

  /**
   * Create a shareable payment request link with expiry.
   */
  const createPaymentRequest = useCallback(async (input: CreatePaymentRequestInput): Promise<PaymentRequest | null> => {
    setError(null);
    setLoading(true);

    try {
      // Validate safe public key
      if (!isSafePublicAddress(input.destination)) {
        throw new Error('Destination address must be a valid Stellar public key (G...) and never a secret key.');
      }

      // Validate amount
      if (!isValidPaymentAmount(input.amount)) {
        throw new Error('Please enter a valid payment amount greater than zero.');
      }

      // Validate expiry
      if (!input.expiresInMinutes || input.expiresInMinutes <= 0) {
        throw new Error('Please specify a valid expiration duration in minutes.');
      }

      const req = await paymentRequestAPI.createRequest(input);
      setActiveRequest(req);
      const url = buildPaymentRequestUrl(req);
      setShareableUrl(url);
      return req;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate payment request link.';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load and resolve a payment request from a share link (payload or ID).
   */
  const resolvePaymentRequest = useCallback(async (reqQueryOrId: string): Promise<PaymentRequest | null> => {
    setError(null);
    setLoading(true);
    setExecutionResult(null);

    try {
      if (!reqQueryOrId || !reqQueryOrId.trim()) {
        throw new Error('No payment request identifier or payload provided.');
      }

      const req = await paymentRequestAPI.resolveRequest(reqQueryOrId);

      // Verify privacy & security: ensure link destination never leaks private key
      if (!isSafePublicAddress(req.destination)) {
        throw new Error('The payment request contains an invalid or unsafe destination address.');
      }

      setActiveRequest(req);
      return req;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to resolve payment request link.';
      setError(msg);
      setActiveRequest(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Approves or denies payment consent. Authorization decision owned by backend.
   */
  const handlePaymentConsent = useCallback(
    async (sourcePublicKey: string, consentApproved: boolean): Promise<PaymentExecutionResult> => {
      setError(null);
      setLoading(true);

      try {
        if (!activeRequest) {
          throw new Error('No active payment request found.');
        }

        if (isPaymentRequestExpired(activeRequest)) {
          const expiredResult: PaymentExecutionResult = {
            success: false,
            error: 'This payment request link has expired.',
            status: 'expired',
          };
          setExecutionResult(expiredResult);
          return expiredResult;
        }

        if (!consentApproved) {
          const deniedResult = await paymentRequestAPI.executePayment(activeRequest.id, sourcePublicKey, false);
          setExecutionResult(deniedResult);
          return deniedResult;
        }

        if (!isSafePublicAddress(sourcePublicKey)) {
          throw new Error('Invalid source wallet address.');
        }

        const result = await paymentRequestAPI.executePayment(activeRequest.id, sourcePublicKey, true);
        setExecutionResult(result);
        if (result.success) {
          setActiveRequest((prev) => (prev ? { ...prev, status: 'completed' } : null));
        }
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Payment authorization failed.';
        setError(msg);
        const failResult: PaymentExecutionResult = {
          success: false,
          error: msg,
          status: 'failed',
        };
        setExecutionResult(failResult);
        return failResult;
      } finally {
        setLoading(false);
      }
    },
    [activeRequest]
  );

  const reset = useCallback(() => {
    setActiveRequest(null);
    setShareableUrl(null);
    setError(null);
    setExecutionResult(null);
  }, []);

  return {
    loading,
    error,
    activeRequest,
    shareableUrl,
    timeRemaining,
    executionResult,
    isExpired: activeRequest ? isPaymentRequestExpired(activeRequest) : false,
    createPaymentRequest,
    resolvePaymentRequest,
    handlePaymentConsent,
    reset,
  };
}
