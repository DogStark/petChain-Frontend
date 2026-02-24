import { useState } from 'react';
import QRCode from 'qrcode.react';
import { twoFactorAPI } from '../../lib/api/twoFactorAPI';
import { useAuth } from '../../contexts/AuthContext';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpToken, setTotpToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { tokens } = useAuth();

  const handleSetup = async () => {
    if (!tokens?.accessToken) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const data = await twoFactorAPI.setup(tokens.accessToken);
      setQrCodeUrl(data.qrCodeUrl);
      setBackupCodes(data.backupCodes);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!tokens?.accessToken || !totpToken) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await twoFactorAPI.enable(tokens.accessToken, totpToken);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enable failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'setup') {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Enable Two-Factor Authentication</h2>
        <p className="text-gray-600 mb-6">
          Add an extra layer of security to your account with 2FA.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleSetup}
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Setting up...' : 'Setup 2FA'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Scan QR Code</h2>
      
      <div className="text-center mb-4">
        <QRCode value={qrCodeUrl} size={200} />
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
      </p>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Enter verification code:
        </label>
        <input
          type="text"
          value={totpToken}
          onChange={(e) => setTotpToken(e.target.value)}
          placeholder="000000"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={6}
        />
      </div>

      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-medium text-sm mb-2">Backup Codes</h3>
        <p className="text-xs text-gray-600 mb-2">Save these codes in a safe place:</p>
        <div className="grid grid-cols-2 gap-1 text-xs font-mono">
          {backupCodes.map((code, i) => (
            <div key={i} className="bg-white p-1 rounded">{code}</div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleEnable}
          disabled={isLoading || !totpToken}
          className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? 'Enabling...' : 'Enable 2FA'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
      
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}