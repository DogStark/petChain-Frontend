/**
 * TypeScript interfaces and types for the NEPA smart contract.
 */

/** Supported network names */
export type NetworkName = 'testnet' | 'mainnet';

/** Network configuration for a deployed contract */
export interface NetworkConfig {
  /** Stellar network passphrase */
  networkPassphrase: string;
  /** Deployed contract ID on this network */
  contractId: string;
  /** Soroban RPC endpoint URL */
  rpcUrl: string;
}

/** Result of a pay_bill contract call */
export interface PayBillResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/** Result of a get_total_paid contract call */
export interface GetTotalPaidResult {
  meterId: string;
  totalPaid: number;
}

/** Parameters for the pay_bill contract method */
export interface PayBillParams {
  /** Meter identifier */
  meter_id: string;
  /** Amount to pay (u32) */
  amount: number;
}

/** Parameters for the get_total_paid contract method */
export interface GetTotalPaidParams {
  /** Meter identifier */
  meter_id: string;
}

/** Deployment information for the contract */
export interface DeploymentInfo {
  network: NetworkName;
  contractId: string;
  deployedAt?: string;
  wasmHash?: string;
}
