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

/** How a transaction is signed before broadcast. */
export type SigningMethod = 'software' | 'hardware';

/** Connection state of a hardware wallet device. */
export type HardwareWalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Supported hardware wallet vendors. */
export type HardwareWalletVendor = 'ledger' | 'trezor';

export interface HardwareWalletDevice {
  vendor: HardwareWalletVendor;
  /** Human readable device name, e.g. "Ledger Nano X". */
  name: string;
  /** Stellar public key exposed by the device. */
  publicKey: string;
  /** BIP-44 derivation path used to derive the Stellar key. */
  derivationPath: string;
}

/** Minimal transport contract a hardware wallet adapter must implement. */
export interface HardwareWalletAdapter {
  vendor: HardwareWalletVendor;
  connect(): Promise<HardwareWalletDevice>;
  disconnect(): Promise<void>;
  /** Signs a base64 transaction envelope XDR and returns the signed envelope XDR. */
  signTransaction(envelopeXdr: string, derivationPath: string): Promise<string>;
}

/** Preview of a signed transaction shown before broadcast. */
export interface SignedTransactionPreview {
  signingMethod: SigningMethod;
  /** Base64 envelope XDR of the signed transaction. */
  envelopeXdr: string;
  /** Transaction hash (hex) of the signed envelope. */
  hash: string;
  sourcePublicKey: string;
  networkPassphrase: string;
  fee: string;
  operationCount: number;
  /** Signer public keys present on the envelope. */
  signers: string[];
  /** Ledger sequence after which the transaction is invalid. */
  validUntilLedger?: number;
}

export interface FeeEstimate {
  base: string;
  recommended: string;
  high: string;
}
