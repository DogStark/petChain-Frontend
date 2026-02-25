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
  const { tokens } = useAuth();

  const handleGenerateBackupCodes = async () => {
    if (!tokens?.accessToken) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const data = await twoFactorAPI.generateBackupCodes(tokens.accessToken);
      setBackupCodes(data.backupCodes);
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
          <p className="text-gray-600 mb-6">
            Generate backup codes to recover your account if you lose access to your authenticator app.
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
                <div key={i} className="bg-white p-2 rounded border">{code}</div>
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