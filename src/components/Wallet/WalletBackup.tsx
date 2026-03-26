import React, { useState } from 'react';
import { Download, ShieldCheck, AlertTriangle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import type { WalletAccount, BackupData } from '../../types/wallet';

interface Props {
  wallet: WalletAccount | null;
  onExportBackup: (pin: string) => Promise<BackupData>;
}

export default function WalletBackup({ wallet, onExportBackup }: Props) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  if (!wallet) {
    return (
      <div className="text-center py-12 text-gray-400">
        Select a wallet to manage its backup.
      </div>
    );
  }

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    if (!pin) return;
    setError(null);
    setLoading(true);
    try {
      const backup = await onExportBackup(pin);

      // Trigger browser download
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `petchain-wallet-backup-${wallet.label.replace(/\s+/g, '-')}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExported(true);
      setPin('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes('decrypt') || err.message.includes('operation')
            ? 'Incorrect PIN. Please try again.'
            : err.message
          : 'Export failed.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Status */}
      <div
        className={`flex items-center gap-3 rounded-xl px-5 py-4 border ${
          wallet.backupVerified
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}
      >
        {wallet.backupVerified ? (
          <ShieldCheck size={24} className="text-green-600 flex-shrink-0" />
        ) : (
          <AlertTriangle size={24} className="text-yellow-600 flex-shrink-0" />
        )}
        <div>
          <p className={`font-semibold text-sm ${wallet.backupVerified ? 'text-green-800' : 'text-yellow-800'}`}>
            {wallet.backupVerified ? 'Backup verified' : 'Backup not yet verified'}
          </p>
          <p className={`text-xs mt-0.5 ${wallet.backupVerified ? 'text-green-600' : 'text-yellow-600'}`}>
            {wallet.backupVerified
              ? 'This wallet has been backed up. Keep your backup file safe.'
              : 'Export and store your backup before using this wallet with real funds.'}
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">How backup works</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>Your secret key is exported in AES-256-GCM encrypted form.</li>
          <li>The backup file is useless without your PIN — store them separately.</li>
          <li>A SHA-256 checksum protects against file tampering.</li>
          <li>Store the backup offline (USB, paper copy of the PIN).</li>
        </ul>
      </div>

      {/* Export Form */}
      <form onSubmit={handleExport} className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">
            Wallet: <span className="font-normal text-gray-600">{wallet.label}</span>
          </p>
          <p className="text-xs text-gray-400 font-mono break-all">{wallet.publicKey}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enter your PIN to unlock backup
          </label>
          <div className="relative">
            <input
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Your wallet PIN…"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPin((s) => !s)}
              className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {exported && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle size={15} />
            Backup downloaded. Store it in a secure location.
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !pin}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Download size={16} />
          {loading ? 'Exporting…' : 'Export Encrypted Backup'}
        </button>
      </form>
    </div>
  );
}
