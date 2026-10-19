/**
 * Tests for the single validated Stellar network config (issue #853).
 * Wallet, Horizon, explorer, and transaction configuration must always move
 * together; mixing testnet and mainnet assets must be rejected.
 */
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  getStellarNetwork,
  isTestnetNetwork,
  validateNetworkConfig,
  getNetworkConfig,
  getNetworkConfigFor,
  getHorizonUrl,
  getNetworkPassphrase,
  getExplorerUrl,
  isWalletNetworkActive,
} from './network';
import { NETWORK_CONFIGS } from './types';

const ENV_VAR = 'NEXT_PUBLIC_STELLAR_NETWORK';
const originalEnv = process.env[ENV_VAR];

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env[ENV_VAR];
  } else {
    process.env[ENV_VAR] = originalEnv;
  }
});

describe('getStellarNetwork', () => {
  it('defaults to TESTNET when the env var is unset', () => {
    delete process.env[ENV_VAR];
    expect(getStellarNetwork()).toBe('TESTNET');
    expect(isTestnetNetwork()).toBe(true);
  });

  it('accepts both "public" and "mainnet" spellings consistently', () => {
    process.env[ENV_VAR] = 'public';
    expect(getStellarNetwork()).toBe('PUBLIC');
    process.env[ENV_VAR] = 'mainnet';
    expect(getStellarNetwork()).toBe('PUBLIC');
  });

  it('treats unknown values as testnet', () => {
    process.env[ENV_VAR] = 'maybe-public';
    expect(getStellarNetwork()).toBe('TESTNET');
  });
});

describe('validateNetworkConfig', () => {
  it('accepts the canonical TESTNET config', () => {
    expect(validateNetworkConfig(NETWORK_CONFIGS.TESTNET)).toEqual(NETWORK_CONFIGS.TESTNET);
  });

  it('accepts the canonical PUBLIC config', () => {
    expect(validateNetworkConfig(NETWORK_CONFIGS.PUBLIC)).toEqual(NETWORK_CONFIGS.PUBLIC);
  });

  it('rejects a mixed testnet/mainnet config', () => {
    expect(() =>
      validateNetworkConfig({
        ...NETWORK_CONFIGS.TESTNET,
        horizonUrl: NETWORK_CONFIGS.PUBLIC.horizonUrl,
      })
    ).toThrow(/Invalid Stellar network configuration/);
  });

  it('rejects a public config signed with the testnet passphrase', () => {
    expect(() =>
      validateNetworkConfig({
        ...NETWORK_CONFIGS.PUBLIC,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
    ).toThrow(/networkPassphrase/);
  });

  it('rejects a testnet config without a friendbot URL', () => {
    expect(() =>
      validateNetworkConfig({ ...NETWORK_CONFIGS.TESTNET, friendbotUrl: '' })
    ).toThrow(/friendbotUrl/);
  });
});

describe('getNetworkConfig / getNetworkConfigFor', () => {
  it('returns one validated config for the active network', () => {
    delete process.env[ENV_VAR];
    const config = getNetworkConfig();
    expect(config.isTestnet).toBe(true);
    expect(config.horizonUrl).toBe(NETWORK_CONFIGS.TESTNET.horizonUrl);
    expect(config.networkPassphrase).toBe(StellarSdk.Networks.TESTNET);
    expect(config.explorerUrl).toBe(NETWORK_CONFIGS.TESTNET.explorerUrl);
  });

  it('routes an explicit network through the same validated config', () => {
    const config = getNetworkConfigFor('PUBLIC');
    expect(config.isTestnet).toBe(false);
    expect(config.horizonUrl).toBe('https://horizon.stellar.org');
    expect(config.networkPassphrase).toBe(StellarSdk.Networks.PUBLIC);
  });
});

describe('shared helpers', () => {
  it('returns the correct Horizon URL per network', () => {
    expect(getHorizonUrl('TESTNET')).toBe('https://horizon-testnet.stellar.org');
    expect(getHorizonUrl('PUBLIC')).toBe('https://horizon.stellar.org');
  });

  it('returns the correct passphrase per network', () => {
    expect(getNetworkPassphrase('TESTNET')).toBe(StellarSdk.Networks.TESTNET);
    expect(getNetworkPassphrase('PUBLIC')).toBe(StellarSdk.Networks.PUBLIC);
  });

  it('returns the correct explorer URL per network', () => {
    expect(getExplorerUrl('TESTNET')).toBe('https://stellar.expert/explorer/testnet');
    expect(getExplorerUrl('PUBLIC')).toBe('https://stellar.expert/explorer/public');
  });

  it('reports whether a wallet network matches the active app network', () => {
    delete process.env[ENV_VAR];
    expect(isWalletNetworkActive('TESTNET')).toBe(true);
    expect(isWalletNetworkActive('PUBLIC')).toBe(false);
  });
});
