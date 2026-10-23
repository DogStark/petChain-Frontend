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
  /**
   * Trustline and reserve policy used by the payment flow to report whether a
   * recipient can receive an asset. Values mirror Stellar network reserve rules
   * and are overridable per environment.
   */
  trustline: {
    /** Base reserve in stroops (XLM * 10^-7) per Stellar protocol */
    baseReserveStroops: string;
    /** Subentry count multiplier: each trustline/offer/signer adds one base reserve */
    subentryMultiplier: number;
    /** Whether to surface trustline status to the payment form by default */
    exposeStatusByDefault: boolean;
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
    trustline: {
      baseReserveStroops:
        process.env.STELLAR_BASE_RESERVE_STROOPS || '5000000',
      subentryMultiplier: Number(
        process.env.STELLAR_SUBENTRY_MULTIPLIER || '1',
      ),
      exposeStatusByDefault:
        process.env.STELLAR_TRUSTLINE_STATUS_DEFAULT !== 'false',
    },
  }),
);
