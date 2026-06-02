export type NetworkKey = 'mainnet' | 'testnet' | 'futurenet';

export interface ContractAddresses {
  [contractName: string]: string;
}

export interface NetworkConfig {
  key: NetworkKey;
  displayName: string;
  horizonUrl: string;
  passphrase: string;
  contractAddresses: ContractAddresses;
  federationServer?: string;
  friendbotUrl?: string;
}

const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  testnet: {
    key: 'testnet',
    displayName: 'Stellar Testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
    friendbotUrl: 'https://friendbot.stellar.org',
    contractAddresses: {
      // Replace these placeholder addresses with real contracts for your deployment
      PAYMENT_CONTRACT: '',
      TOKEN_CONTRACT: '',
    },
  },
  mainnet: {
    key: 'mainnet',
    displayName: 'Stellar Public Network',
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: 'Public Global Stellar Network ; September 2015',
    contractAddresses: {
      PAYMENT_CONTRACT: '',
      TOKEN_CONTRACT: '',
    },
  },
  futurenet: {
    key: 'futurenet',
    displayName: 'Stellar Futurenet',
    // Futurenet endpoints are often custom; change this to your futurenet Horizon URL
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    passphrase: 'Futurenet Network ; 2020',
    contractAddresses: {
      PAYMENT_CONTRACT: '',
      TOKEN_CONTRACT: '',
    },
  },
};

export const DEFAULT_NETWORK: NetworkKey = 'testnet';

export function getNetworkKeyFromEnv(explicit?: string): NetworkKey {
  const raw = (explicit || process.env.NEXT_PUBLIC_STELLAR_NETWORK || process.env.STELLAR_NETWORK || process.env.NEXT_PUBLIC_NETWORK || process.env.NODE_ENV || '').toLowerCase();

  if (raw.includes('main')) return 'mainnet';
  if (raw.includes('future')) return 'futurenet';
  if (raw.includes('test')) return 'testnet';

  // Fallback: production -> mainnet, otherwise testnet
  return process.env.NODE_ENV === 'production' ? 'mainnet' : DEFAULT_NETWORK;
}

export function getActiveNetworkConfig(explicitEnvVar?: string): NetworkConfig {
  const key = getNetworkKeyFromEnv(explicitEnvVar);
  return NETWORKS[key];
}

export function getAllNetworkConfigs(): Record<NetworkKey, NetworkConfig> {
  return NETWORKS;
}

export default getActiveNetworkConfig;
export type NetworkType = 'testnet' | 'mainnet';

export interface NetworkConfig {
  networkPassphrase: string;
  contractId: string;
  rpcUrl: string;
}

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA",
    rpcUrl: "https://soroban-testnet.stellar.org",
  },
  mainnet: {
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    contractId: "MAINNET_CONTRACT_ID_HERE",
    rpcUrl: "https://soroban.stellar.org",
  },
};

export const NETWORK_STORAGE_KEY = 'wata-board-network';
export const NETWORK_CHANGE_EVENT = 'wata-network-change';

export function getNetworkConfig(network: NetworkType): NetworkConfig {
  return NETWORKS[network];
}

export function getStoredNetwork(): NetworkType | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
  return stored === 'testnet' || stored === 'mainnet' ? stored : null;
}

export function getCurrentNetwork(): NetworkType {
  // Check localStorage first (user preference)
  const stored = getStoredNetwork();
  if (stored) return stored;
  // Fall back to environment variable
  return getNetworkFromEnv();
}

export function getNetworkFromEnv(): NetworkType {
  const network = import.meta?.env?.VITE_NETWORK;
  return network === 'mainnet' ? 'mainnet' : 'testnet';
}

export function getCurrentNetworkConfig(): NetworkConfig {
  const network = getCurrentNetwork();
  return getNetworkConfig(network);
}

export function isValidNetwork(network: string): network is NetworkType {
  return network === 'testnet' || network === 'mainnet';
}
