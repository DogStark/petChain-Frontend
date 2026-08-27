import { useState } from 'react';
import { twoFactorAPI } from '../../lib/api/twoFactorAPI';
import { useAuth } from '../../contexts/AuthContext';

interface TwoFactorRecoveryProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function TwoFactorRecovery({ onComplete, onCancel }: TwoFactorRecoveryProps) {
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTotpPrompt, setShowTotpPrompt] = useState(false);
  const [totpToken, setTotpToken] = useState('');
  const { tokens } = useAuth();

  const handleGenerateBackupCodes = () => {
    setShowTotpPrompt(true);
    setError('');
  };

  const handleConfirmGeneration = async () => {
    if (!tokens?.accessToken || !totpToken) return;

    setIsLoading(true);
    setError('');

    try {
      const data = await twoFactorAPI.generateBackupCodes(totpToken);
      setBackupCodes(data.backupCodes);
      setShowTotpPrompt(false);
      setTotpToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate backup codes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const codesText = backupCodes.join('\n');
    try {
      await navigator.clipboard.writeText(codesText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownload = () => {
    const codesText = backupCodes.join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'petchain-2fa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">2FA Recovery Codes</h2>

      {!backupCodes.length ? (
        <div>
          {!showTotpPrompt ? (
            <>
              <p className="text-gray-600 mb-6">
                Generate backup codes to recover your account if you lose access to your authenticator
                app.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleGenerateBackupCodes}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Generating...' : 'Generate Backup Codes'}
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <h3 className="font-medium text-sm mb-3 text-yellow-800">⚠️ Regenerating Backup Codes</h3>
              <p className="text-xs text-yellow-700 mb-4">
                This action will invalidate all existing backup codes. Enter your authenticator code to confirm.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-700">Authenticator Code</label>
                <input
                  type="text"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmGeneration}
                  disabled={isLoading || !totpToken}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoading ? 'Confirming...' : 'Confirm & Generate'}
                </button>
                <button
                  onClick={() => {
                    setShowTotpPrompt(false);
                    setTotpToken('');
                    setError('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="font-medium text-sm mb-2 text-yellow-800">⚠️ Important</h3>
            <p className="text-xs text-yellow-700">
              Save these codes in a safe place. Each code can only be used once.
            </p>
          </div>

          <div className="mb-4 p-3 bg-gray-50 border rounded">
            <div className="grid grid-cols-2 gap-2 text-sm font-mono">
              {backupCodes.map((code, i) => (
                <div key={i} className="bg-white p-2 rounded border">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={handleCopyToClipboard}
              className="flex-1 bg-gray-600 text-white py-2 px-3 rounded hover:bg-gray-700 text-sm"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 bg-gray-600 text-white py-2 px-3 rounded hover:bg-gray-700 text-sm"
            >
              Download
            </button>
          </div>

          <button
            onClick={onComplete}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          >
            I've Saved These Codes
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
