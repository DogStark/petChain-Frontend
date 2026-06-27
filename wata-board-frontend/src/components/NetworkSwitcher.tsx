import React, { useState, useEffect, useRef } from 'react';
import type { NetworkType } from '../utils/network-config';
import { getCurrentNetwork, getCurrentNetworkConfig, NETWORK_STORAGE_KEY, NETWORK_CHANGE_EVENT } from '../utils/network-config';

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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingNetwork, setPendingNetwork] = useState<NetworkType | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsDevelopment(import.meta.env?.DEV || false);
    
    // Check localStorage first, then fall back to environment
    const savedNetwork = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (savedNetwork === 'mainnet' || savedNetwork === 'testnet') {
      setCurrentNetwork(savedNetwork);
    } else {
      const network = (import.meta.env?.VITE_NETWORK as NetworkType) || 'testnet';
      setCurrentNetwork(network);
    }
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showConfirmation) {
        setShowConfirmation(false);
        setPendingNetwork(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showConfirmation]);

  const handleNetworkChange = (newNetwork: NetworkType) => {
    if (newNetwork === currentNetwork) return;
    
    // Always show confirmation when switching
    setPendingNetwork(newNetwork);
    setShowConfirmation(true);
  };

  const confirmNetworkChange = () => {
    if (!pendingNetwork) return;
    
    // Save to localStorage
    localStorage.setItem(NETWORK_STORAGE_KEY, pendingNetwork);
    setCurrentNetwork(pendingNetwork);
    
    // Dispatch custom event for services to listen to
    window.dispatchEvent(new CustomEvent(NETWORK_CHANGE_EVENT, { 
      detail: { network: pendingNetwork } 
    }));
    
    // Call callback
    onNetworkChange?.(pendingNetwork);
    
    // In development, show a message about restart
    if (isDevelopment) {
      const message = `Network changed to ${pendingNetwork}. Please restart the development server for some changes to take full effect.`;
      console.warn(message);
      alert(message);
    }
    
    setShowConfirmation(false);
    setPendingNetwork(null);
  };

  const cancelNetworkChange = () => {
    setShowConfirmation(false);
    setPendingNetwork(null);
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
    <>
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
            aria-pressed={!isMainnet}
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
            aria-pressed={isMainnet}
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

      {/* Confirmation Dialog */}
      {showConfirmation && pendingNetwork && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-labelledby="network-switch-title"
          aria-modal="true"
        >
          <div 
            ref={confirmationRef}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl shadow-black/20"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                pendingNetwork === 'mainnet' ? 'bg-orange-500/20' : 'bg-sky-500/20'
              }`}>
                ⚠️
              </div>
              <h3 id="network-switch-title" className="text-lg font-semibold text-slate-100">
                Switch to {pendingNetwork.toUpperCase()}?
              </h3>
            </div>
            
            <p className="text-sm text-slate-300 mb-4">
              {pendingNetwork === 'mainnet' 
                ? 'You are about to switch to the live Stellar Mainnet. Transactions will use real XLM.'
                : 'You are about to switch to the Stellar Testnet. Transactions will use test XLM.'
              }
            </p>

            {pendingNetwork === 'mainnet' && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-4">
                <p className="text-xs text-red-300 font-medium flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Warning: This is a production network. Real funds will be used.</span>
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelNetworkChange}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmNetworkChange}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 ${
                  pendingNetwork === 'mainnet'
                    ? 'bg-orange-600 hover:bg-orange-500 focus:ring-orange-500/50'
                    : 'bg-sky-600 hover:bg-sky-500 focus:ring-sky-500/50'
                }`}
              >
                Switch to {pendingNetwork.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
