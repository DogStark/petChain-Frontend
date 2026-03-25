/**
 * Fee Estimation Service for Stellar Transactions
 * Provides accurate fee estimation for Stellar network transactions
 */

import { Horizon, Networks, TransactionBuilder, Operation, Asset, BASE_FEE } from '@stellar/stellar-sdk';
import { requestAccess } from '../utils/wallet-bridge';
import { getCurrentNetworkConfig } from '../utils/network-config';

export interface FeeEstimate {
  baseFee: number; // Base fee in stroops
  totalFee: number; // Total fee in XLM
  minFee: number; // Minimum recommended fee in XLM
  recommendedFee: number; // Recommended fee for current network conditions
  operationCount: number;
  estimatedTime: number; // Estimated confirmation time in seconds
}

export interface TransactionDetails {
  amount: string;
  destination: string;
  asset?: Asset;
  memo?: string;
}

export class FeeEstimationService {
  private server: Horizon.Server;
  private networkConfig: any;

  constructor() {
    this.networkConfig = getCurrentNetworkConfig();
    const horizonUrl = this.networkConfig.rpcUrl.replace('soroban', 'horizon');
    this.server = new Horizon.Server(horizonUrl);
  }

  /**
   * Get current network fee statistics
   */
  async getNetworkFees(): Promise<{
    minFee: number;
    recommendedFee: number;
    p50Fee: number;
    p90Fee: number;
  }> {
    try {
      // Get recent ledgers to analyze fee trends
      // FOR TESTS: Bypass ledgers if mock is provided
      if ((window as any).__MOCK_STELLAR_LEDGER__) {
        console.log('[FeeEstimationService] Using mock stellar ledger');
        return (window as any).__MOCK_STELLAR_LEDGER__;
      }

      const latestLedger = await this.server.ledgers()
        .limit(1)
        .order('desc')
        .call();

      // For now, use Stellar's base fee as minimum
      // In a production environment, you'd analyze recent transactions
      const minFee = parseInt(BASE_FEE);
      const recommendedFee = Math.max(parseInt(BASE_FEE), 100); // At least 100 stroops
      const p50Fee = Math.max(parseInt(BASE_FEE), 200); // 50th percentile
      const p90Fee = Math.max(parseInt(BASE_FEE), 500); // 90th percentile

      return {
        minFee,
        recommendedFee,
        p50Fee,
        p90Fee
      };
    } catch (error) {
      console.error('Failed to get network fees:', error);
      // Fallback to base fee
      return {
        minFee: parseInt(BASE_FEE),
        recommendedFee: parseInt(BASE_FEE) * 2,
        p50Fee: parseInt(BASE_FEE) * 3,
        p90Fee: parseInt(BASE_FEE) * 5
      };
    }
  }

  /**
   * Estimate fees for a simple payment transaction
   */
  async estimatePaymentFee(
    amount: string,
    destination: string = "GDOPTS553GBKXNF3X4YCQ7NPZUQ644QAN4SV7JEZHAVOVROAUQTSKEHO" // Valid mock destination account
  ): Promise<FeeEstimate> {
    console.log('[FeeEstimationService] estimatePaymentFee called for amount:', amount);
    try {
      // Get the public key from Freighter
      console.log('[FeeEstimationService] Requesting access...');
      const accessResult = await requestAccess();
      console.log('[FeeEstimationService] Access result:', JSON.stringify(accessResult));
      if (accessResult.error || !accessResult.address) {
        throw new Error(accessResult.error || 'Could not get public key from wallet');
      }

      const pubKeyString = accessResult.address;

      // Get account details
      // FOR TESTS: Bypass loadAccount if mock is provided
      let account;
      if ((window as any).__MOCK_STELLAR_ACCOUNT__) {
        console.log('[FeeEstimationService] Using mock stellar account');
        account = (window as any).__MOCK_STELLAR_ACCOUNT__(pubKeyString);
      } else {
        console.log('[FeeEstimationService] Loading account from server...');
        account = await this.server.loadAccount(pubKeyString);
      }
      
      console.log('[FeeEstimationService] Getting network fees...');
      // Get network fee statistics
      const networkFees = await this.getNetworkFees();
      console.log('[FeeEstimationService] Network fees:', JSON.stringify(networkFees));

      // Create a sample transaction to estimate fees
      let transaction;
      if ((window as any).__MOCK_STELLAR_TRANSACTION__) {
        console.log('[FeeEstimationService] Using mock stellar transaction');
        transaction = (window as any).__MOCK_STELLAR_TRANSACTION__(account, amount);
      } else {
        transaction = new TransactionBuilder(account, {
          fee: networkFees.recommendedFee.toString(),
          networkPassphrase: this.networkConfig.networkPassphrase,
        })
          .addOperation(Operation.payment({
            destination,
            asset: Asset.native(),
            amount,
          }))
          .setTimeout(30)
          .build();
      }

      // Calculate fees
      const operationCount = transaction.operations.length;
      const baseFee = parseInt(transaction.fee);
      const totalFeeStroops = baseFee * operationCount;
      const totalFeeXLM = totalFeeStroops / 10000000; // Convert from stroops to XLM

      return {
        baseFee,
        totalFee: totalFeeXLM,
        minFee: networkFees.minFee / 10000000,
        recommendedFee: networkFees.recommendedFee / 10000000,
        operationCount,
        estimatedTime: this.estimateConfirmationTime(networkFees.recommendedFee)
      };
    } catch (error) {
      console.error('Fee estimation failed:', error);
      // Return fallback estimate
      return {
        baseFee: parseInt(BASE_FEE),
        totalFee: parseInt(BASE_FEE) / 10000000,
        minFee: parseInt(BASE_FEE) / 10000000,
        recommendedFee: (parseInt(BASE_FEE) * 2) / 10000000,
        operationCount: 1,
        estimatedTime: 5
      };
    }
  }

  /**
   * Estimate fees for complex transactions with multiple operations
   */
  async estimateComplexTransactionFee(
    operations: Operation[],
    fee: number = parseInt(BASE_FEE) * 2
  ): Promise<FeeEstimate> {
    try {
      const accessResult = await requestAccess();
      if (accessResult.error || !accessResult.address) {
        throw new Error(accessResult.error || 'Could not get public key from wallet');
      }
      
      const pubKeyString = accessResult.address;

      const account = await this.server.loadAccount(pubKeyString);
      const networkFees = await this.getNetworkFees();

      const transactionBuilder = new TransactionBuilder(account, {
        fee: fee.toString(),
        networkPassphrase: this.networkConfig.networkPassphrase,
      });

      // Add all operations
      operations.forEach(op => transactionBuilder.addOperation(op));
      
      const transaction = transactionBuilder.setTimeout(30).build();

      const operationCount = transaction.operations.length;
      const baseFee = parseInt(transaction.fee);
      const totalFeeStroops = baseFee * operationCount;
      const totalFeeXLM = totalFeeStroops / 10000000;

      return {
        baseFee,
        totalFee: totalFeeXLM,
        minFee: networkFees.minFee / 10000000,
        recommendedFee: networkFees.recommendedFee / 10000000,
        operationCount,
        estimatedTime: this.estimateConfirmationTime(fee)
      };
    } catch (error) {
      console.error('Complex fee estimation failed:', error);
      return {
        baseFee: fee,
        totalFee: (fee * operations.length) / 10000000,
        minFee: parseInt(BASE_FEE) / 10000000,
        recommendedFee: (parseInt(BASE_FEE) * 2) / 10000000,
        operationCount: operations.length,
        estimatedTime: 5
      };
    }
  }

  /**
   * Estimate confirmation time based on fee
   */
  private estimateConfirmationTime(feeStroops: number): number {
    // Simple heuristic based on fee amount
    if (feeStroops >= 500) return 3; // High priority
    if (feeStroops >= 200) return 5; // Medium priority
    if (feeStroops >= 100) return 10; // Low priority
    return 15; // Very low priority
  }

  /**
   * Get fee recommendations for different priority levels
   */
  async getFeeRecommendations(): Promise<{
    economy: { fee: number; time: number };
    standard: { fee: number; time: number };
    priority: { fee: number; time: number };
  }> {
    const networkFees = await this.getNetworkFees();

    return {
      economy: {
        fee: networkFees.minFee / 10000000,
        time: this.estimateConfirmationTime(networkFees.minFee)
      },
      standard: {
        fee: networkFees.recommendedFee / 10000000,
        time: this.estimateConfirmationTime(networkFees.recommendedFee)
      },
      priority: {
        fee: networkFees.p90Fee / 10000000,
        time: this.estimateConfirmationTime(networkFees.p90Fee)
      }
    };
  }

  /**
   * Format fee for display
   */
  formatFee(feeXLM: number, decimals: number = 7): string {
    return feeXLM.toFixed(decimals) + ' XLM';
  }

  /**
   * Calculate total cost including fees
   */
  calculateTotalCost(amount: number, fee: number): number {
    return amount + fee;
  }
}

// Create singleton instance
export const feeEstimationService = new FeeEstimationService();

// Utility functions
export const feeUtils = {
  /**
   * Convert stroops to XLM
   */
  stroopsToXLM: (stroops: number): number => stroops / 10000000,

  /**
   * Convert XLM to stroops
   */
  xlmToStroops: (xlm: number): number => Math.floor(xlm * 10000000),

  /**
   * Check if fee is sufficient for current network conditions
   */
  isFeeSufficient: (feeStroops: number, networkFees: any): boolean => {
    return feeStroops >= networkFees.minFee;
  },

  /**
   * Get fee priority level
   */
  getFeePriority: (feeStroops: number, networkFees: any): 'economy' | 'standard' | 'priority' => {
    if (feeStroops >= networkFees.p90Fee) return 'priority';
    if (feeStroops >= networkFees.recommendedFee) return 'standard';
    return 'economy';
  }
};

export default feeEstimationService;
