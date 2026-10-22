import { Wifi, WifiOff } from 'lucide-react';
import { useDataMode } from '@/hooks/useDataMode';

/**
 * Quick toggle button for data mode.
 * Useful for testing and quick switching.
 */
export default function DataModeToggle() {
  const { mode, isReducedMode, toggleMode } = useDataMode();

  return (
    <button
      onClick={toggleMode}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 transition-colors"
      aria-label={`Data mode: ${mode}. Click to toggle`}
      title={isReducedMode ? 'Switch to full data mode' : 'Switch to reduced data mode'}
    >
      {isReducedMode ? (
        <WifiOff className="w-4 h-4" aria-hidden="true" />
      ) : (
        <Wifi className="w-4 h-4" aria-hidden="true" />
      )}
      <span className="text-xs font-medium hidden sm:inline">
        {isReducedMode ? 'Reduced' : 'Full'}
      </span>
    </button>
  );
}
