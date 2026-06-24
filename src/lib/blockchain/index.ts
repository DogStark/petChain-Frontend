import { StellarService } from './StellarService';
import { NETWORK_CONFIGS } from './types';

// Declare process to fix linting errors if types are not properly picked up
declare const process: any;

// Detect network from environment
const isTestnet =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'public' : true;
const defaultConfig = isTestnet ? NETWORK_CONFIGS.TESTNET : NETWORK_CONFIGS.PUBLIC;

// Export shared instance (Singleton pattern for common use cases)
export const stellarService = new StellarService(defaultConfig);

// Export class and types for DI
export * from './StellarService';
export * from './types';
