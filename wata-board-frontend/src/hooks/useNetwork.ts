import { useState, useEffect, useCallback } from 'react';
import type { NetworkType } from '../utils/network-config';
import { getCurrentNetwork, getStoredNetwork, NETWORK_CHANGE_EVENT } from '../utils/network-config';

export interface UseNetworkReturn {
  network: NetworkType;
  isMainnet: boolean;
  isTestnet: boolean;
  switchNetwork: (network: NetworkType) => void;
  canSwitch: boolean;
}

export function useNetwork(autoRefresh: boolean = true): UseNetworkReturn {
  const [network, setNetwork] = useState<NetworkType>(() => {
    // Initialize from localStorage or environment
    return getStoredNetwork() || getCurrentNetwork();
  });

  const listenToNetworkChanges = useCallback(() => {
    const handler = (e: CustomEvent) => {
      setNetwork(e.detail.network);
    };
    window.addEventListener(NETWORK_CHANGE_EVENT, handler as any);
    return () => window.removeEventListener(NETWORK_CHANGE_EVENT, handler as any);
  }, []);

  useEffect(() => {
    // Check for initial stored network
    const stored = getStoredNetwork();
    if (stored && stored !== network) {
      setNetwork(stored);
    }
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      return listenToNetworkChanges();
    }
  }, [listenToNetworkChanges, autoRefresh]);

  const switchNetwork = useCallback((newNetwork: NetworkType) => {
    // This will be handled by the NetworkSwitcher component
    // Services can listen to the NETWORK_CHANGE_EVENT
    const event = new CustomEvent(NETWORK_CHANGE_EVENT, { detail: { network: newNetwork } });
    window.dispatchEvent(event);
  }, []);

  return {
    network,
    isMainnet: network === 'mainnet',
    isTestnet: network === 'testnet',
    switchNetwork,
    canSwitch: import.meta?.env?.DEV || false
  };
}

export default useNetwork;