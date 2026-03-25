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
    contractId: "MAINNET_CONTRACT_ID_HERE", // Replace with actual mainnet contract ID
    rpcUrl: "https://soroban.stellar.org",
  },
};

export function getNetworkConfig(network: NetworkType): NetworkConfig {
  return NETWORKS[network];
}

export function getNetworkFromEnv(): NetworkType {
  // For frontend (Vite): import.meta.env.VITE_NETWORK
  const network = import.meta.env.VITE_NETWORK;
  return network === 'mainnet' ? 'mainnet' : 'testnet';
}

export function getCurrentNetworkConfig(): NetworkConfig {
  const network = getNetworkFromEnv();
  return getNetworkConfig(network);
}

export function isValidNetwork(network: string): network is NetworkType {
  return network === 'testnet' || network === 'mainnet';
}
