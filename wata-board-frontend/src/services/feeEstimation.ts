/**
 * Fee Estimation Service for Stellar Transactions
 * Queries Horizon fee_stats endpoint for accurate, real-time fee data.
 */

import { Horizon, BASE_FEE } from '@stellar/stellar-sdk';
import { getCurrentNetworkConfig, NETWORK_CHANGE_EVENT } from '../utils/network-config';

const STROOPS_PER_XLM = 10_000_000;
const CACHE_TTL_MS = 10_000; // 10 second TTL
const SURGE_MULTIPLIER = 1.5; // Applied when network is congested

export interface FeeTiers {
  min: number;         // Minimum fee in XLM
  recommended: number; // Recommended fee in XLM (p50)
  max: number;         // High-priority fee in XLM (p90)
}

export interface FeeEstimate {
  tiers: FeeTiers;
  totalFee: number;            // Recommended total fee in XLM for given op count
  operationCount: number;
  isSurge: boolean;            // true when surge pricing is active
  estimatedTimeSeconds: number;
}

interface FeeCache {
  tiers: FeeTiers;
  isSurge: boolean;
  timestamp: number;
}

// ─── Utility conversions ──────────────────────────────────────────────────────
export const stroopsToXLM = (stroops: number): number => stroops / STROOPS_PER_XLM;
export const xlmToStroops = (xlm: number): number => Math.floor(xlm * STROOPS_PER_XLM);

// ─── Service ──────────────────────────────────────────────────────────────────
export class FeeEstimationService {
  private server: Horizon.Server;
  private cache: FeeCache | null = null;
  private networkConfig: ReturnType<typeof getCurrentNetworkConfig>;
  private networkChangeHandler: (() => void) | null = null;

  constructor() {
    this.networkConfig = getCurrentNetworkConfig();
    this.server = this.buildServer();

    // Re-initialise when the user switches networks
    if (typeof window !== 'undefined') {
      this.networkChangeHandler = () => {
        this.networkConfig = getCurrentNetworkConfig();
        this.server = this.buildServer();
        this.cache = null;
      };
      window.addEventListener(NETWORK_CHANGE_EVENT, this.networkChangeHandler as EventListener);
    }
  }

  private buildServer(): Horizon.Server {
    const horizonUrl = this.networkConfig.rpcUrl.replace('soroban', 'horizon');
    return new Horizon.Server(horizonUrl);
  }

  /**
   * Fetch fee tiers from Horizon fee_stats, with TTL caching.
   */
  async getFeeTiers(): Promise<{ tiers: FeeTiers; isSurge: boolean }> {
    if (this.cache && Date.now() - this.cache.timestamp < CACHE_TTL_MS) {
      return { tiers: this.cache.tiers, isSurge: this.cache.isSurge };
    }

    try {
      const feeStats = await this.server.feeStats();

      const p10 = parseInt(feeStats.fee_charged.p10);
      const p50 = parseInt(feeStats.fee_charged.p50);
      const p90 = parseInt(feeStats.fee_charged.p90);
      const ledgerCapacityUsage = parseFloat(feeStats.ledger_capacity_usage);

      const isSurge = ledgerCapacityUsage > 0.8;
      const surgeMultiplier = isSurge ? SURGE_MULTIPLIER : 1;

      const tiers: FeeTiers = {
        min: stroopsToXLM(Math.max(p10, parseInt(BASE_FEE))),
        recommended: stroopsToXLM(Math.ceil(p50 * surgeMultiplier)),
        max: stroopsToXLM(Math.ceil(p90 * surgeMultiplier)),
      };

      this.cache = { tiers, isSurge, timestamp: Date.now() };
      return { tiers, isSurge };
    } catch {
      // Fallback to BASE_FEE if Horizon is unreachable
      const base = parseInt(BASE_FEE);
      const tiers: FeeTiers = {
        min: stroopsToXLM(base),
        recommended: stroopsToXLM(base * 2),
        max: stroopsToXLM(base * 5),
      };
      return { tiers, isSurge: false };
    }
  }

  /**
   * Estimate fee for a transaction with the given number of operations.
   */
  async estimateFee(operationCount = 1): Promise<FeeEstimate> {
    const { tiers, isSurge } = await this.getFeeTiers();
    return {
      tiers,
      totalFee: tiers.recommended * operationCount,
      operationCount,
      isSurge,
      estimatedTimeSeconds: isSurge ? 10 : 5,
    };
  }

  /** Format a fee value in XLM for display. */
  formatFee(feeXLM: number, decimals = 7): string {
    return `${feeXLM.toFixed(decimals)} XLM`;
  }

  /** Total cost of a payment including the recommended fee. */
  async totalCost(amountXLM: number, operationCount = 1): Promise<number> {
    const estimate = await this.estimateFee(operationCount);
    return amountXLM + estimate.totalFee;
  }

  /** Invalidate the cache (useful for testing). */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Estimate fee for a payment given an XLM amount string and optional destination.
   * The destination is accepted for API compatibility but fee is based on a
   * single-operation payment transaction.
   */
  async estimatePaymentFee(amount: string, _destination?: string): Promise<FeeEstimate> {
    // A standard payment is one operation regardless of amount or destination
    return this.estimateFee(1);
  }

  /**
   * Return the current fee tiers and surge status.
   * Convenience wrapper used by useFeeEstimation.getFeeRecommendations().
   */
  async getFeeRecommendations(): Promise<{ tiers: FeeTiers; isSurge: boolean }> {
    return this.getFeeTiers();
  }
}

export const feeEstimationService = new FeeEstimationService();
export default feeEstimationService;
