import { StellarService } from './StellarService';
import { getNetworkConfig } from './network';

// Detect network from environment and validate it once at startup so the
// Horizon, passphrase, explorer, and friendbot settings always move together.
const defaultConfig = getNetworkConfig();

// Export shared instance (Singleton pattern for common use cases)
export const stellarService = new StellarService(defaultConfig);

// Export class and types for DI
export * from './StellarService';
export * from './types';
