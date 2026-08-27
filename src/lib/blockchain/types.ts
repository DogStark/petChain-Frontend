import * as StellarSdk from '@stellar/stellar-sdk';

export interface StellarConfig {
  horizonUrl: string;
  networkPassphrase: string;
  isTestnet: boolean;
}

export interface TransactionResult {
  success: boolean;
  hash?: string;
  ledger?: number;
  error?: string;
  feeCharged?: string;
}

export interface AccountDetails {
  publicKey: string;
  balances: StellarSdk.Horizon.HorizonApi.BalanceLine[];
  sequence: string;
  subentryCount: number;
}

export interface SubmitOptions {
  retryAttempts?: number;
  baseFee?: string;
  memo?: StellarSdk.Memo;
  timeoutSeconds?: number;
  rebuild?: () => Promise<StellarSdk.Transaction | StellarSdk.FeeBumpTransaction>;
}

export interface MedicalRecord {
  id: string;
  petId: string;
  type: string;
  critical: boolean;
  data: Record<string, unknown>;
}

export const NETWORK_CONFIGS = {
  TESTNET: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: StellarSdk.Networks.TESTNET,
    isTestnet: true,
  },
  PUBLIC: {
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    isTestnet: false,
  },
};
