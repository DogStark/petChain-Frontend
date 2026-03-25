/**
 * React hook for fee estimation
 * Provides a simple interface for estimating and managing transaction fees
 */

import { useState, useCallback } from 'react';
import { feeEstimationService } from '../services/feeEstimation';
import type { FeeEstimate } from '../services/feeEstimation';

export interface UseFeeEstimationReturn {
  estimate: FeeEstimate | null;
  isLoading: boolean;
  error: string | null;
  estimateFee: (amount: string, destination?: string) => Promise<FeeEstimate | null>;
  clearEstimate: () => void;
  getFeeRecommendations: () => Promise<any>;
}

export function useFeeEstimation(): UseFeeEstimationReturn {
  const [estimate, setEstimate] = useState<FeeEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimateFee = useCallback(async (amount: string, destination?: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      setEstimate(null);
      setError(null);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const feeEstimate = await feeEstimationService.estimatePaymentFee(amount, destination);
      setEstimate(feeEstimate);
      return feeEstimate;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to estimate fees';
      setError(errorMessage);
      setEstimate(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearEstimate = useCallback(() => {
    setEstimate(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const getFeeRecommendations = useCallback(async () => {
    try {
      return await feeEstimationService.getFeeRecommendations();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get fee recommendations';
      setError(errorMessage);
      return null;
    }
  }, []);

  return {
    estimate,
    isLoading,
    error,
    estimateFee,
    clearEstimate,
    getFeeRecommendations
  };
}

export default useFeeEstimation;
