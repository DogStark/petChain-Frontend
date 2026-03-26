import { useState } from 'react';
import { twoFactorUtils } from '../../utils/twoFactorUtils';

interface TwoFactorVerifyProps {
  email: string;
  password: string;
  onVerify: (token: string) => Promise<void>;
  onRecover: (backupCode: string) => Promise<void>;
  onCancel: () => void;
}

export default function TwoFactorVerify({ email, password, onVerify, onRecover, onCancel }: TwoFactorVerifyProps) {
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsLoading(true);
    setError('');

    try {
      if (mode === 'totp') {
        await onVerify(token);
      } else {
        await onRecover(token);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      setError(errorMessage === 'Invalid 2FA token' ? 
        'Invalid code. Please check your authenticator app and try again.' : 
        errorMessage === 'Invalid backup code' ?
        'Invalid backup code. Please check and try again.' : errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Two-Factor Authentication</h2>
      
      <div className="flex mb-4 bg-gray-100 rounded p-1">
        <button
          onClick={() => setMode('totp')}
          className={`flex-1 py-2 px-3 rounded text-sm ${
            mode === 'totp' ? 'bg-white shadow' : 'text-gray-600'
          }`}
        >
          Authenticator
        </button>
        <button
          onClick={() => setMode('backup')}
          className={`flex-1 py-2 px-3 rounded text-sm ${
            mode === 'backup' ? 'bg-white shadow' : 'text-gray-600'
          }`}
        >
          Backup Code
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {mode === 'totp' ? 'Enter code from authenticator app:' : 'Enter backup code:'}
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => {
              const formatted = mode === 'totp' 
                ? twoFactorUtils.formatTOTPToken(e.target.value)
                : twoFactorUtils.formatBackupCode(e.target.value);
              setToken(formatted);
            }}
            placeholder={mode === 'totp' ? '000000' : 'XXXXXXXX'}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={mode === 'totp' ? 6 : 8}
            required
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isLoading || !token}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}