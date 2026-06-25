import { useState, useCallback } from 'react';
import { ratingAPI, Review, RatingStats } from '@/lib/api/ratingAPI';

export function useRating() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitReview = useCallback(async (rating: number, comment: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      if (comment.trim().length === 0) {
        throw new Error('Review comment cannot be empty');
      }
      const result = await ratingAPI.submitReview(rating, comment);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit review';
      setError(msg);
      return { success: false as const, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getUserReview = useCallback(async (userAddress: string): Promise<Review | null> => {
    try {
      return await ratingAPI.getUserReview(userAddress);
    } catch {
      return null;
    }
  }, []);

  const getRatingStats = useCallback(async (): Promise<RatingStats> => {
    try {
      return await ratingAPI.getRatingStats();
    } catch {
      return { total_reviews: 0, average_rating: 0, rating_counts: [0, 0, 0, 0, 0] };
    }
  }, []);

  const verifyReview = useCallback(async (userAddress: string, txHash: string): Promise<boolean> => {
    try {
      return await ratingAPI.verifyReview(userAddress, txHash);
    } catch {
      return false;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    submitReview,
    getUserReview,
    getRatingStats,
    verifyReview,
    isLoading,
    error,
    clearError,
  };
}
