import React from 'react';
import { Wifi, WifiOff, Info } from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';

/**
 * Settings component for managing data mode preference.
 * 
 * Privacy: All settings stored locally, never sent to backend.
 * Accessibility: Fully keyboard navigable with clear labels and descriptions.
 */
export default function DataModeSettings() {
  const { mode, isReducedMode, setMode } = useDataMode();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          {isReducedMode ? (
            <WifiOff className="w-5 h-5 text-blue-600" aria-hidden="true" />
          ) : (
            <Wifi className="w-5 h-5 text-blue-600" aria-hidden="true" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Data Mode
          </h3>
          <p className="text-sm text-gray-600">
            Control how images and charts are loaded to manage bandwidth usage.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="radio"
            name="data-mode"
            value="full"
            checked={mode === 'full'}
            onChange={() => setMode('full')}
            className="mt-1 w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-describedby="full-mode-description"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900 mb-1">Full Mode</div>
            <p id="full-mode-description" className="text-sm text-gray-600">
              Load all images and charts automatically. Best for stable connections.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="radio"
            name="data-mode"
            value="reduced"
            checked={mode === 'reduced'}
            onChange={() => setMode('reduced')}
            className="mt-1 w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-describedby="reduced-mode-description"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900 mb-1">Reduced Data Mode</div>
            <p id="reduced-mode-description" className="text-sm text-gray-600">
              Defer large images and charts. Load them only when needed. Emergency and critical care actions remain immediately available.
            </p>
          </div>
        </label>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-sm text-blue-900">
          <strong>Privacy Notice:</strong> This preference is stored locally on your device and never shared with our servers.
        </div>
      </div>
    </div>
  );
}
