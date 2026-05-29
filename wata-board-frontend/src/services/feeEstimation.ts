/**
 * Fee Estimation Service for Stellar Transactions
 * Queries Horizon fee_stats for current fee tiers and payment estimates.
 */

import { BASE_FEE, Horizon } from '@stellar/stellar-sdk';
import { getCurrentNetworkConfig, NETWORK_CHANGE_EVENT } from '../utils/network-config';

const STROOPS_PER_XLM = 10_000_000;
const CACHE_TTL_MS = 10_000;
const SURGE_MULTIPLIER = 1.5;

export interface FeeTiers {
  min: number;
  recommended: number;
  max: number;
}

export interface FeeEstimate {
  tiers: FeeTiers;
  totalFee: number;
  operationCount: number;
  isSurge: boolean;
  estimatedTimeSeconds: number;
}

export interface FeeRecommendation {
  label: 'low' | 'recommended' | 'priority';
  fee: number;
  estimatedTimeSeconds: number;
}

interface FeeCache {
  tiers: FeeTiers;
  isSurge: boolean;
  timestamp: number;
}

export const stroopsToXLM = (stroops: number): number => stroops / STROOPS_PER_XLM;
export const xlmToStroops = (xlm: number): number => Math.floor(xlm * STROOPS_PER_XLM);

export class FeeEstimationService {
  private server: Horizon.Server;
  private cache: FeeCache | null = null;
  private networkChangeHandler: (() => void) | null = null;

  constructor() {
    this.server = this.createServer();

    if (typeof window !== 'undefined') {
      this.networkChangeHandler = () => {
        this.server = this.createServer();
        this.clearCache();
      };
      window.addEventListener(NETWORK_CHANGE_EVENT, this.networkChangeHandler);
    }
  }

  private createServer(): Horizon.Server {
    const config = getCurrentNetworkConfig();
    return new Horizon.Server(config.rpcUrl.replace('soroban', 'horizon'));
  }

  async getFeeTiers(): Promise<{ tiers: FeeTiers; isSurge: boolean }> {
    if (this.cache && Date.now() - this.cache.timestamp < CACHE_TTL_MS) {
      return { tiers: this.cache.tiers, isSurge: this.cache.isSurge };
    }

    try {
      const feeStats = await this.server.feeStats();
      const p10 = Number.parseInt(feeStats.fee_charged.p10, 10);
      const p50 = Number.parseInt(feeStats.fee_charged.p50, 10);
      const p90 = Number.parseInt(feeStats.fee_charged.p90, 10);
      const ledgerCapacityUsage = Number.parseFloat(feeStats.ledger_capacity_usage);
      const isSurge = ledgerCapacityUsage > 0.8;
      const multiplier = isSurge ? SURGE_MULTIPLIER : 1;

      const tiers: FeeTiers = {
        min: stroopsToXLM(Math.max(p10, Number.parseInt(BASE_FEE, 10))),
        recommended: stroopsToXLM(Math.ceil(p50 * multiplier)),
        max: stroopsToXLM(Math.ceil(p90 * multiplier)),
      };

      this.cache = { tiers, isSurge, timestamp: Date.now() };
      return { tiers, isSurge };
    } catch {
      const base = Number.parseInt(BASE_FEE, 10);
      const tiers: FeeTiers = {
        min: stroopsToXLM(base),
        recommended: stroopsToXLM(base * 2),
        max: stroopsToXLM(base * 5),
      };
      return { tiers, isSurge: false };
    }
  }

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

  async estimatePaymentFee(amount: string, destination?: string): Promise<FeeEstimate> {
    const operationCount = destination ? 1 : 1;
    const parsedAmount = Number.parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Enter a valid payment amount before estimating fees.');
    }

    return this.estimateFee(operationCount);
  }

  async getFeeRecommendations(): Promise<FeeRecommendation[]> {
    const { tiers, isSurge } = await this.getFeeTiers();

    return [
      { label: 'low', fee: tiers.min, estimatedTimeSeconds: isSurge ? 20 : 10 },
      { label: 'recommended', fee: tiers.recommended, estimatedTimeSeconds: isSurge ? 10 : 5 },
      { label: 'priority', fee: tiers.max, estimatedTimeSeconds: isSurge ? 5 : 3 },
    ];
  }

  formatFee(feeXLM: number, decimals = 7): string {
    return `${feeXLM.toFixed(decimals)} XLM`;
  }

  async totalCost(amountXLM: number, operationCount = 1): Promise<number> {
    const estimate = await this.estimateFee(operationCount);
    return amountXLM + estimate.totalFee;
  }

  clearCache(): void {
    this.cache = null;
  }

  dispose(): void {
    if (this.networkChangeHandler && typeof window !== 'undefined') {
      window.removeEventListener(NETWORK_CHANGE_EVENT, this.networkChangeHandler);
    }
  }
}

export const feeEstimationService = new FeeEstimationService();
export default feeEstimationService;
