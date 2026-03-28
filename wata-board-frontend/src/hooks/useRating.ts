import { useState, useCallback } from 'react';
import { Server, Networks, TransactionBuilder, Operation, BASE_FEE } from '@stellar/stellar-sdk';
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import { getCurrentNetworkConfig } from '../utils/network-config';

export interface Review {
  reviewer: string;
  rating: number;
  comment: string;
  timestamp: number;
  transaction_hash: string;
}

export interface RatingStats {
  total_reviews: number;
  average_rating: number;
  rating_counts: number[];
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

export const useRating = (): RatingHookReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const networkConfig = getCurrentNetworkConfig();
  const server = new Server(networkConfig.rpcUrl);

  const submitReview = useCallback(async (rating: number, comment: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if wallet is connected
      if (!(await isConnected())) {
        throw new Error('Please connect your wallet first');
      }

      // Validate inputs
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      if (comment.length > 500) {
        throw new Error('Review comment must be less than 500 characters');
      }

      if (comment.trim().length === 0) {
        throw new Error('Review comment cannot be empty');
      }

      // Get user's public key
      const publicKey = await requestAccess();
      if (!publicKey) {
        throw new Error('Could not get wallet access');
      }

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
          asset: Operation.payment({
            destination: networkConfig.contractId,
            asset: 'native',
            amount: '0.0000001', // Minimum amount
          }).asset,
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
            new XdrLargeInt('i64', rating).toScVal(),
            // comment: String
            new String(comment).toScVal(),
            // transaction_hash: String
            new String(result.hash).toScVal(),
          ],
        }))
        .setTimeout(30)
        .build();

      // Sign and submit the review transaction
      const signedReviewTx = await signTransaction(reviewTx.toXDR());
      const reviewResult = await server.submitTransaction(signedReviewTx);

      return {
        success: true,
        txHash: reviewResult.hash,
      };

    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to submit review';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, [networkConfig, server]);

  const getUserReview = useCallback(async (userAddress: string): Promise<Review | null> => {
    try {
      const contract = new Contract(networkConfig.contractId);
      
      const tx = new TransactionBuilder(new Account(networkConfig.contractId, '1'), {
        fee: BASE_FEE,
        networkPassphrase: networkConfig.networkPassphrase,
      })
        .addOperation(Operation.invokeContractFunction({
          contract: contract.contractId(),
          function: 'get_user_review',
          args: [
            new Address(userAddress).toScVal(),
          ],
        }))
        .setTimeout(30)
        .build();

      // Simulate the transaction to get the result
      const result = await server.simulateTransaction(tx);
      
      if (result.result && result.result !== '0') {
        // Parse the review from the result
        // This is a simplified parsing - you'd need to properly parse the XDR result
        const reviewData = JSON.parse(result.result);
        
        return {
          reviewer: reviewData.reviewer,
          rating: reviewData.rating,
          comment: reviewData.comment,
          timestamp: reviewData.timestamp,
          transaction_hash: reviewData.transaction_hash,
        };
      }

      return null;
    } catch (err: any) {
      console.error('Error getting user review:', err);
      return null;
    }
  }, [networkConfig, server]);

  const getAllReviews = useCallback(async (): Promise<Review[]> => {
    try {
      const contract = new Contract(networkConfig.contractId);
      
      const tx = new TransactionBuilder(new Account(networkConfig.contractId, '1'), {
        fee: BASE_FEE,
        networkPassphrase: networkConfig.networkPassphrase,
      })
        .addOperation(Operation.invokeContractFunction({
          contract: contract.contractId(),
          function: 'get_all_reviews',
          args: [],
        }))
        .setTimeout(30)
        .build();

      // Simulate the transaction to get the result
      const result = await server.simulateTransaction(tx);
      
      if (result.result && result.result !== '0') {
        // Parse the reviews from the result
        // This is a simplified parsing - you'd need to properly parse the XDR result
        const reviewsData = JSON.parse(result.result);
        
        return reviewsData.map((review: any) => ({
          reviewer: review.reviewer,
          rating: review.rating,
          comment: review.comment,
          timestamp: review.timestamp,
          transaction_hash: review.transaction_hash,
        }));
      }

      return [];
    } catch (err: any) {
      console.error('Error getting all reviews:', err);
      return [];
    }
  }, [networkConfig, server]);

  const getRatingStats = useCallback(async (): Promise<RatingStats> => {
    try {
      const contract = new Contract(networkConfig.contractId);
      
      const tx = new TransactionBuilder(new Account(networkConfig.contractId, '1'), {
        fee: BASE_FEE,
        networkPassphrase: networkConfig.networkPassphrase,
      })
        .addOperation(Operation.invokeContractFunction({
          contract: contract.contractId(),
          function: 'get_rating_stats',
          args: [],
        }))
        .setTimeout(30)
        .build();

      // Simulate the transaction to get the result
      const result = await server.simulateTransaction(tx);
      
      if (result.result && result.result !== '0') {
        // Parse the stats from the result
        // This is a simplified parsing - you'd need to properly parse the XDR result
        const statsData = JSON.parse(result.result);
        
        return {
          total_reviews: statsData.total_reviews,
          average_rating: statsData.average_rating / 10, // Convert back from *10
          rating_counts: statsData.rating_counts,
        };
      }

      return {
        total_reviews: 0,
        average_rating: 0,
        rating_counts: [0, 0, 0, 0, 0],
      };
    } catch (err: any) {
      console.error('Error getting rating stats:', err);
      return {
        total_reviews: 0,
        average_rating: 0,
        rating_counts: [0, 0, 0, 0, 0],
      };
    }
  }, [networkConfig, server]);

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
            new String(txHash).toScVal(),
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
  }, [networkConfig, server]);

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
