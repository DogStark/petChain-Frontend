import * as StellarSdk from '@stellar/stellar-sdk';
import type { WalletNetwork } from '../../types/wallet';
import { NETWORK_CONFIGS, StellarConfig } from './types';

const NETWORK_ENV_VAR = 'NEXT_PUBLIC_STELLAR_NETWORK';

/**
 * Reads the network env var once. Accepts both "public" and "mainnet"
 * spellings (case-insensitive) so callers cannot silently disagree about which
 * value selects the public network.
 */
function readNetworkEnv(): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env[NETWORK_ENV_VAR];
}

/**
 * Detects the app-wide Stellar network from the environment.
 * Defaults to TESTNET when the env var is unset or unrecognized.
 */
export function getStellarNetwork(): WalletNetwork {
  const env = readNetworkEnv();
  const normalized = env?.toLowerCase();
  return normalized === 'public' || normalized === 'mainnet' ? 'PUBLIC' : 'TESTNET';
}

/**
 * Returns true when the app is running against the test network.
 */
export function isTestnetNetwork(): boolean {
  return getStellarNetwork() === 'TESTNET';
}

/**
 * Validates that a Stellar network config is internally consistent — the
 * passphrase, Horizon URL, and testnet flag must all describe the same network.
 * Mixing testnet and mainnet endpoints is rejected.
 *
 * @throws Error describing every inconsistency found.
 */
export function validateNetworkConfig(config: StellarConfig): StellarConfig {
  const errors: string[] = [];

  const expectedPassphrase = config.isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC;
  const expectedHorizon = config.isTestnet
    ? NETWORK_CONFIGS.TESTNET.horizonUrl
    : NETWORK_CONFIGS.PUBLIC.horizonUrl;
  const expectedExplorer = config.isTestnet
    ? NETWORK_CONFIGS.TESTNET.explorerUrl
    : NETWORK_CONFIGS.PUBLIC.explorerUrl;

  if (config.networkPassphrase !== expectedPassphrase) {
    errors.push(
      `networkPassphrase "${config.networkPassphrase}" does not match a ${config.isTestnet ? 'testnet' : 'public'} config`
    );
  }
  if (config.horizonUrl !== expectedHorizon) {
    errors.push(`horizonUrl "${config.horizonUrl}" is not the ${config.isTestnet ? 'testnet' : 'public'} Horizon URL`);
  }
  if (config.explorerUrl !== expectedExplorer) {
    errors.push(`explorerUrl "${config.explorerUrl}" is not the ${config.isTestnet ? 'testnet' : 'public'} explorer URL`);
  }
  if (config.isTestnet && !config.friendbotUrl) {
    errors.push('testnet config must include a friendbotUrl');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid Stellar network configuration: ${errors.join('; ')}`);
  }

  return config;
}

/**
 * Returns the single, validated network config for the app-wide network.
 * Wallet, Horizon, explorer, and friendbot settings all come from here so they
 * always move together.
 */
export function getNetworkConfig(): StellarConfig {
  const config = getStellarNetwork() === 'PUBLIC' ? NETWORK_CONFIGS.PUBLIC : NETWORK_CONFIGS.TESTNET;
  return validateNetworkConfig(config);
}

/**
 * Returns the validated config for an explicit network (used for per-wallet
 * routing). Throws on any inconsistency.
 */
export function getNetworkConfigFor(network: WalletNetwork): StellarConfig {
  const config = network === 'PUBLIC' ? NETWORK_CONFIGS.PUBLIC : NETWORK_CONFIGS.TESTNET;
  return validateNetworkConfig(config);
}

/** Horizon server URL for a network. */
export function getHorizonUrl(network: WalletNetwork): string {
  return getNetworkConfigFor(network).horizonUrl;
}

/** Stellar network passphrase for a network. */
export function getNetworkPassphrase(network: WalletNetwork): string {
  return getNetworkConfigFor(network).networkPassphrase;
}

/** Explorer base URL for a network. */
export function getExplorerUrl(network: WalletNetwork): string {
  return getNetworkConfigFor(network).explorerUrl;
}

/** True only when the wallet network matches the app's active network. */
export function isWalletNetworkActive(network: WalletNetwork): boolean {
  return network === getStellarNetwork();
}

