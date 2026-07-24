import { StellarService } from './StellarService';
import { NETWORK_CONFIGS } from './types';
import { isTestnetNetwork } from './network';

// Detect network from environment
const isTestnet = isTestnetNetwork();
const defaultConfig = isTestnet ? NETWORK_CONFIGS.TESTNET : NETWORK_CONFIGS.PUBLIC;

// Export shared instance (Singleton pattern for common use cases)
export const stellarService = new StellarService(defaultConfig);

// Export class and types for DI
export * from './StellarService';
export * from './types';
