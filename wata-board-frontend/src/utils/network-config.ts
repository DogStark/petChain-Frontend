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
