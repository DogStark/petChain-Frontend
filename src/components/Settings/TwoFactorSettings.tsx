import { useState, useEffect } from 'react';
import { twoFactorAPI } from '../../lib/api/twoFactorAPI';
import { useAuth } from '../../contexts/AuthContext';
import TwoFactorSetup from './TwoFactorSetup';
import TwoFactorRecovery from './TwoFactorRecovery';

export default function TwoFactorSettings() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [backupCodesCount, setBackupCodesCount] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [totpToken, setTotpToken] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { tokens } = useAuth();

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    if (!tokens?.accessToken) return;
    
    try {
      const status = await twoFactorAPI.getStatus(tokens.accessToken);
      setIsEnabled(status.isEnabled);
      setBackupCodesCount(status.backupCodesCount);
    } catch (err) {
      setError('Failed to load 2FA status');
    }
  };

  const handleDisable = async () => {
    if (!tokens?.accessToken || !totpToken) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await twoFactorAPI.disable(tokens.accessToken, totpToken);
      setIsEnabled(false);
      setShowDisable(false);
      setTotpToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBackupCodes = async () => {
    if (!tokens?.accessToken) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const data = await twoFactorAPI.generateBackupCodes(tokens.accessToken);
      setNewBackupCodes(data.backupCodes);
      setBackupCodesCount(data.backupCodes.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate backup codes');
    } finally {
      setIsLoading(false);
    }
  };

  if (showSetup) {
    return (
      <TwoFactorSetup
        onComplete={() => {
          setShowSetup(false);
          loadStatus();
        }}
        onCancel={() => setShowSetup(false)}
      />
    );
  }

  if (showRecovery) {
    return (
      <TwoFactorRecovery
        onComplete={() => {
          setShowRecovery(false);
          loadStatus();
        }}
        onCancel={() => setShowRecovery(false)}
      />
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium mb-4">Two-Factor Authentication</h3>
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-medium">Status: {isEnabled ? 'Enabled' : 'Disabled'}</p>
          {isEnabled && (
            <p className="text-sm text-gray-600">Backup codes: {backupCodesCount}</p>
          )}
        </div>
        <div className={`w-3 h-3 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {!isEnabled ? (
        <button
          onClick={() => setShowSetup(true)}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Enable 2FA
        </button>
      ) : (
        <div className="space-y-3">
          {!showDisable ? (
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisable(true)}
                className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
              >
                Disable 2FA
              </button>
              <button
                onClick={() => setShowRecovery(true)}
                disabled={isLoading}
                className="bg-yellow-600 text-white py-2 px-4 rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                Manage Backup Codes
              </button>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm mb-3">Enter your authenticator code to disable 2FA:</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value)}
                  placeholder="000000"
                  className="px-3 py-2 border border-gray-300 rounded"
                  maxLength={6}
                />
                <button
                  onClick={handleDisable}
                  disabled={isLoading || !totpToken}
                  className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowDisable(false)}
                  className="bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {newBackupCodes.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <h4 className="font-medium mb-2">New Backup Codes</h4>
              <p className="text-sm text-gray-600 mb-2">Save these codes in a safe place:</p>
              <div className="grid grid-cols-2 gap-1 text-sm font-mono">
                {newBackupCodes.map((code, i) => (
                  <div key={i} className="bg-white p-2 rounded">{code}</div>
                ))}
              </div>
              <button
                onClick={() => setNewBackupCodes([])}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                I've saved these codes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}