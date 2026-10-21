import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type DataMode = 'full' | 'reduced';

export interface DataModeState {
  mode: DataMode;
  isReducedMode: boolean;
}

export interface DataModeContextType extends DataModeState {
  setMode: (mode: DataMode) => void;
  toggleMode: () => void;
}

const DataModeContext = createContext<DataModeContextType | undefined>(undefined);

export const useDataMode = () => {
  const context = useContext(DataModeContext);
  if (context === undefined) {
    throw new Error('useDataMode must be used within a DataModeProvider');
  }
  return context;
};

interface DataModeProviderProps {
  children: React.ReactNode;
}

const STORAGE_KEY = 'petchain-data-mode';

/**
 * Provides reduced-data mode for low-bandwidth users.
 * 
 * In reduced mode:
 * - Large images are deferred until user explicitly requests them
 * - Charts show simplified visualizations or defer rendering
 * - Emergency and critical care actions remain immediately available
 * 
 * Privacy by default: Mode preference is stored locally and never sent to backend.
 */
export const DataModeProvider: React.FC<DataModeProviderProps> = ({ children }) => {
  const [mode, setModeState] = useState<DataMode>('full');

  // Load preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as DataMode | null;
      if (stored && (stored === 'full' || stored === 'reduced')) {
        setModeState(stored);
      }
    } catch (error) {
      console.error('Error loading data mode preference:', error);
    }
  }, []);

  const setMode = useCallback((newMode: DataMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch (error) {
      console.error('Error saving data mode preference:', error);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'full' ? 'reduced' : 'full');
  }, [mode, setMode]);

  const value: DataModeContextType = {
    mode,
    isReducedMode: mode === 'reduced',
    setMode,
    toggleMode,
  };

  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
};
