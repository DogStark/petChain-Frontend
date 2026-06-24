export type WalletNetwork = 'TESTNET' | 'PUBLIC';

export interface WalletAccount {
  id: string;
  publicKey: string;
  encryptedSecretKey: string;
  iv: string;
  salt: string;
  label: string;
  type: 'standard' | 'multisig';
  network: WalletNetwork;
  createdAt: string;
  backupVerified: boolean;
}

export interface WalletBalance {
  asset_type: 'native' | 'credit_alphanum4' | 'credit_alphanum12' | 'liquidity_pool_shares';
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
}

export interface WalletSigner {
  publicKey: string;
  weight: number;
  label?: string;
}

export interface WalletThresholds {
  low_threshold: number;
  med_threshold: number;
  high_threshold: number;
}

export interface MultiSigConfig {
  signers: WalletSigner[];
  masterWeight: number;
  lowThreshold: number;
  medThreshold: number;
  highThreshold: number;
}

export interface WalletMonitoringData {
  publicKey: string;
  balances: WalletBalance[];
  sequence: string;
  signers: WalletSigner[];
  thresholds: WalletThresholds;
  lastFetched: string;
}

export interface WalletTransaction {
  sourcePublicKey: string;
  destination: string;
  amount: string;
  asset: string; // 'XLM' or 'CODE:ISSUER'
  memo?: string;
  fee?: string;
}

export interface BroadcastResult {
  hash: string;
  ledger: number;
  successful: boolean;
  envelopeXdr: string;
  resultXdr: string;
}

export interface BackupData {
  version: number;
  publicKey: string;
  encryptedKey: string;
  iv: string;
  salt: string;
  network: string;
  label: string;
  createdAt: string;
  checksum: string;
}

export interface FeeEstimate {
  base: string;
  recommended: string;
  high: string;
}
