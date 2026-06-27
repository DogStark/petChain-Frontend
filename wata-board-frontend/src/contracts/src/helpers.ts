/**
 * Helper functions for interacting with the NEPA smart contract.
 */
import { networks } from './index';
import type { NetworkName, NetworkConfig, PayBillParams, GetTotalPaidParams } from './types';

/**
 * Returns the network configuration for the given network name.
 */
export function getNetworkConfig(network: NetworkName): NetworkConfig {
  return networks[network];
}

/**
 * Validates pay_bill parameters before submitting a transaction.
 */
export function validatePayBillParams(params: PayBillParams): void {
  if (!params.meter_id || params.meter_id.trim().length === 0) {
    throw new Error('meter_id must be a non-empty string');
  }
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new Error('amount must be a positive integer');
  }
  if (params.amount > 4_294_967_295) {
    throw new Error('amount exceeds u32 maximum value');
  }
}

/**
 * Validates get_total_paid parameters.
 */
export function validateGetTotalPaidParams(params: GetTotalPaidParams): void {
  if (!params.meter_id || params.meter_id.trim().length === 0) {
    throw new Error('meter_id must be a non-empty string');
  }
}

/**
 * Returns true if the given string is a valid Stellar contract ID (56-char base32).
 */
export function isValidContractId(contractId: string): boolean {
  return /^[A-Z2-7]{56}$/.test(contractId);
}

/**
 * Returns the contract ID for the given network.
 */
export function getContractId(network: NetworkName): string {
  return networks[network].contractId;
}
