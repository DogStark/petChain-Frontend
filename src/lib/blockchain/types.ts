import * as StellarSdk from '@stellar/stellar-sdk';

export interface StellarConfig {
  horizonUrl: string;
  networkPassphrase: string;
  isTestnet: boolean;
  /** Base URL for the Stellar explorer (used for transaction links). */
  explorerUrl: string;
  /** Friendbot URL used for testnet faucet funding. */
  friendbotUrl: string;
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

export const NETWORK_CONFIGS: Record<'TESTNET' | 'PUBLIC', StellarConfig> = {
  TESTNET: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: StellarSdk.Networks.TESTNET,
    isTestnet: true,
    explorerUrl: 'https://stellar.expert/explorer/testnet',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  PUBLIC: {
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    isTestnet: false,
    explorerUrl: 'https://stellar.expert/explorer/public',
    friendbotUrl: '',
  },
};
