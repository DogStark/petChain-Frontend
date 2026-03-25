import React, { useState, useEffect } from 'react';
import type { NetworkType } from '../utils/network-config';
import { getCurrentNetworkConfig, getNetworkConfig } from '../utils/network-config';

interface NetworkSwitcherProps {
  onNetworkChange?: (network: NetworkType) => void;
  showLabel?: boolean;
}

export const NetworkSwitcher: React.FC<NetworkSwitcherProps> = ({ 
  onNetworkChange, 
  showLabel = true 
}) => {
  const [currentNetwork, setCurrentNetwork] = useState<NetworkType>('testnet');
  const [isDevelopment, setIsDevelopment] = useState(false);

  useEffect(() => {
    // Check if we're in development mode
    setIsDevelopment(import.meta.env.DEV);
    
    // Get current network from environment
    const network = import.meta.env.VITE_NETWORK as NetworkType || 'testnet';
    setCurrentNetwork(network);
  }, []);

  const handleNetworkChange = (newNetwork: NetworkType) => {
    setCurrentNetwork(newNetwork);
    onNetworkChange?.(newNetwork);
    
    // In development, show a message about restarting
    if (isDevelopment) {
      const message = `Network changed to ${newNetwork}. Please restart the development server for changes to take effect.`;
      console.warn(message);
      alert(message);
    }
  };

  const currentConfig = getCurrentNetworkConfig();
  const isMainnet = currentNetwork === 'mainnet';

  if (!isDevelopment) {
    // In production, just show the current network without switching capability
    return (
      <div className="flex items-center gap-2">
        {showLabel && <span className="text-sm text-slate-400">Network:</span>}
        <div className={`rounded-full px-3 py-1 text-xs font-medium ${
          isMainnet 
            ? 'bg-orange-500/10 text-orange-300 ring-1 ring-inset ring-orange-500/20' 
            : 'bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/20'
        }`}>
          {currentNetwork.toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {showLabel && <span className="text-sm text-slate-400">Network:</span>}
      <div className="flex rounded-lg bg-slate-800 p-1">
        <button
          onClick={() => handleNetworkChange('testnet')}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            !isMainnet
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Testnet
        </button>
        <button
          onClick={() => handleNetworkChange('mainnet')}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            isMainnet
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Mainnet
        </button>
      </div>
      {isMainnet && (
        <div className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/20">
          ⚠️ MAINNET
        </div>
      )}
    </div>
  );
};
