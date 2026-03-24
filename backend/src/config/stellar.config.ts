import { registerAs } from '@nestjs/config';

export type StellarNetwork = 'PUBLIC' | 'TESTNET';

export interface StellarNetworkConfig {
  horizonUrl: string;
  networkPassphrase: string;
}

export interface StellarConfig {
  defaultNetwork: StellarNetwork;
  networks: Record<StellarNetwork, StellarNetworkConfig>;
  /** Base64-encoded 32-byte key for AES-256 wallet encryption at rest */
  walletMasterKey?: string;
  hsm?: {
    enabled: boolean;
    provider?: 'aws-cloudhsm' | 'azure-keyvault' | 'custom';
    config?: Record<string, unknown>;
  };
}

export const stellarConfig = registerAs(
  'stellar',
  (): StellarConfig => ({
    defaultNetwork:
      (process.env.STELLAR_DEFAULT_NETWORK as StellarNetwork) || 'TESTNET',
    networks: {
      PUBLIC: {
        horizonUrl:
          process.env.STELLAR_PUBLIC_HORIZON_URL ||
          'https://horizon.stellar.org',
        networkPassphrase:
          process.env.STELLAR_PUBLIC_NETWORK_PASSPHRASE ||
          'Public Global Stellar Network ; September 2015',
      },
      TESTNET: {
        horizonUrl:
          process.env.STELLAR_TESTNET_HORIZON_URL ||
          'https://horizon-testnet.stellar.org',
        networkPassphrase:
          process.env.STELLAR_TESTNET_NETWORK_PASSPHRASE ||
          'Test SDF Network ; September 2015',
      },
    },
    // HSM integration configuration (provider-agnostic)
    // When enabled, wallet operations can route to HSM for key management
    walletMasterKey: process.env.STELLAR_WALLET_MASTER_KEY || undefined,
    hsm: {
      enabled: process.env.HSM_ENABLED === 'true',
      provider: (process.env.HSM_PROVIDER as any) || undefined,
      config: process.env.HSM_CONFIG
        ? JSON.parse(process.env.HSM_CONFIG)
        : undefined,
    },
  }),
);
