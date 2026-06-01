import { useState, useCallback } from 'react';
import Server, { Networks, TransactionBuilder, Operation, BASE_FEE, Contract, Account, Address, Asset, nativeToScVal } from '@stellar/stellar-sdk';
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import { getCurrentNetworkConfig } from '../utils/network-config';

export interface Review {
  reviewer: string;
  rating: number;
  comment: string;
  timestamp: number;
  transaction_hash: string;
}

export interface RatingHookReturn {
  submitReview: (rating: number, comment: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  getUserReview: (userAddress: string) => Promise<Review | null>;
  getAllReviews: () => Promise<Review[]>;
  getRatingStats: () => Promise<RatingStats>;
  verifyReview: (userAddress: string, txHash: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

// ─── In-memory review store (replaces broken contract calls) ─────────────────
// In production this would be replaced with real contract/API calls.
const reviewStore: Map<string, Review> = new Map();

function computeStats(): RatingStats {
  const reviews = Array.from(reviewStore.values());
  const total = reviews.length;
  const counts = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const r of reviews) {
    sum += r.rating;
    counts[r.rating - 1]++;
  }
  return {
    total_reviews: total,
    average_rating: total > 0 ? sum / total : 0,
    rating_counts: counts,
  };
}

export const useRating = (): RatingHookReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitReview = useCallback(
    async (rating: number, comment: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      setIsLoading(true);
      setError(null);

      try {
        // Validate inputs
        if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');
        if (comment.trim().length === 0) throw new Error('Review comment cannot be empty');
        if (comment.length > 500) throw new Error('Review comment must be less than 500 characters');

        // Dynamically import wallet-bridge to avoid circular deps
        const { isConnected: checkConnected, requestAccess } = await import('../utils/wallet-bridge');

        const { isConnected: connected } = await checkConnected();
        if (!connected) throw new Error('Please connect your wallet first');

        const { address, error: accessError } = await requestAccess();
        if (accessError || !address) throw new Error(accessError || 'Could not get wallet access');

      if (comment.trim().length === 0) {
        throw new Error('Review comment cannot be empty');
      }

      // Get user's public key
      const keyResult = await requestAccess();
      if (!keyResult || !keyResult.address) {
        throw new Error('Could not get wallet access');
      }
      const publicKey = keyResult.address;

      // Load user account
      const account = await server.loadAccount(publicKey);

      // Create a dummy transaction to get a transaction hash
      // In a real implementation, you might want to use a small XLM transfer
      // or create a custom transaction type for reviews
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: networkConfig.networkPassphrase,
      })
        .addOperation(Operation.payment({
          destination: publicKey, // Self-transfer for minimal cost
          asset: Asset.native(),
          amount: '0.0000001',
        }))
        .setTimeout(30)
        .build();

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction.toXDR());

      // Submit the transaction
      const result = await server.submitTransaction(signedTransaction);

      // Now call the smart contract to submit the review
      const contract = new Contract(networkConfig.contractId);
      
      const reviewTx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: networkConfig.networkPassphrase,
      })
        .addOperation(Operation.invokeContractFunction({
          contract: contract.contractId(),
          function: 'submit_review',
          args: [
            // reviewer: Address
            new Address(publicKey).toScVal(),
            // rating: i64
            nativeToScVal(BigInt(rating), { type: 'i64' }),
            // comment: String
            nativeToScVal(comment),
            // transaction_hash: String
            nativeToScVal(result.hash),
          ],
        }))
        .setTimeout(30)
        .build();

      // Sign and submit the review transaction
      const signedReviewTx = await signTransaction(reviewTx.toXDR());
      const reviewResult = await server.submitTransaction(signedReviewTx);

        reviewStore.set(address, review);

        return { success: true, txHash };
      } catch (err: any) {
        const msg = err?.message || 'Failed to submit review';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const getUserReview = useCallback(async (userAddress: string): Promise<Review | null> => {
    try {
      return reviewStore.get(userAddress) ?? null;
    } catch (err) {
      console.error('Error getting user review:', err);
      return null;
    }
  }, []);

  const getAllReviews = useCallback(async (): Promise<Review[]> => {
    try {
      return Array.from(reviewStore.values());
    } catch (err) {
      console.error('Error getting all reviews:', err);
      return [];
    }
  }, []);

  const getRatingStats = useCallback(async (): Promise<RatingStats> => {
    try {
      return computeStats();
    } catch (err) {
      console.error('Error getting rating stats:', err);
      return { total_reviews: 0, average_rating: 0, rating_counts: [0, 0, 0, 0, 0] };
    }
  }, []);

  const verifyReview = useCallback(async (userAddress: string, txHash: string): Promise<boolean> => {
    try {
      const contract = new Contract(networkConfig.contractId);
      
      const tx = new TransactionBuilder(new Account(networkConfig.contractId, '1'), {
        fee: BASE_FEE,
        networkPassphrase: networkConfig.networkPassphrase,
      })
        .addOperation(Operation.invokeContractFunction({
          contract: contract.contractId(),
          function: 'verify_review',
          args: [
            new Address(userAddress).toScVal(),
            nativeToScVal(txHash),
          ],
        }))
        .setTimeout(30)
        .build();

      // Simulate the transaction to get the result
      const result = await server.simulateTransaction(tx);
      
      return result.result === 'true';
    } catch (err: any) {
      console.error('Error verifying review:', err);
      return false;
    }
  }, []);

  return {
    submitReview,
    getUserReview,
    getAllReviews,
    getRatingStats,
    verifyReview,
    isLoading,
    error,
  };
};
