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
  balances: StellarSdk.Horizon.BalanceLine[];
  sequence: string;
  subentryCount: number;
}

export interface SubmitOptions {
  retryAttempts?: number;
  baseFee?: string;
  memo?: StellarSdk.Memo;
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
