import {
  Download,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  CheckCircle,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { walletAPI } from '../../lib/api/walletAPI';
import type { WalletAccount, BackupData } from '../../types/wallet';
import { copyWithTTL, clearClipboardNow, CLIPBOARD_TTL_MS } from '../../utils/clipboard';

interface Props {
  wallet: WalletAccount | null;
  /** walletId on the server, required for server-side backup storage */
  serverWalletId?: string;
  onExportBackup: (pin: string) => Promise<BackupData>;
}

/** How many seconds the public key copy confirmation is shown. */
const COPY_FEEDBACK_DURATION_MS = 2_000;

export default function WalletBackup({ wallet, serverWalletId, onExportBackup }: Props) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [serverBackupDone, setServerBackupDone] = useState(false);

  // Copy-button state for the public key
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [copyError, setCopyError] = useState<string | null>(null);

  // Clean up clipboard on unmount in case the TTL timer is still running.
  useEffect(() => {
    return () => {
      clearClipboardNow().catch(() => {
        // best-effort
      });
    };
  }, []);

  if (!wallet) {
    return (
      <div className="text-center py-12 text-gray-400">Select a wallet to manage its backup.</div>
    );
  }

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || !wallet) return;
    setError(null);
    setLoading(true);
    try {
      const backup = await onExportBackup(pin);

      // Trigger browser download — the backup file is AES-256-GCM encrypted.
      // We never write it to the clipboard automatically.
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `petchain-wallet-backup-${wallet!.label.replace(/\s+/g, '-')}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExported(true);

      // Also store an encrypted copy on the server if we have a server wallet id.
      // The backup payload contains only the encrypted key — the server never sees plaintext.
      if (serverWalletId) {
        try {
          await walletAPI.storeBackup(serverWalletId, backup);
          setServerBackupDone(true);
        } catch (serverErr) {
          console.warn('Server-side backup failed (local backup was still saved):', serverErr);
        }
      }

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

  async function handleCopyPublicKey() {
    if (!wallet) return;

    // Public key is non-secret but we still use the TTL utility for consistency
    // and to demonstrate the secure copy pattern to users.
    const result = await copyWithTTL(wallet.publicKey, CLIPBOARD_TTL_MS);

    if (result.ok) {
      setCopyState('copied');
      setCopyError(null);
      // Reset feedback after a short interval
      setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_DURATION_MS);
    } else {
      setCopyState('error');
      setCopyError(result.error ?? 'Copy failed.');
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Status */}
      <div
        className={`flex items-center gap-3 rounded-xl px-5 py-4 border ${
          wallet.backupVerified ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
        }`}
      >
        {wallet.backupVerified ? (
          <ShieldCheck size={24} className="text-green-600 flex-shrink-0" />
        ) : (
          <AlertTriangle size={24} className="text-yellow-600 flex-shrink-0" />
        )}
        <div>
          <p
            className={`font-semibold text-sm ${wallet.backupVerified ? 'text-green-800' : 'text-yellow-800'}`}
          >
            {wallet.backupVerified ? 'Backup verified' : 'Backup not yet verified'}
          </p>
          <p
            className={`text-xs mt-0.5 ${wallet.backupVerified ? 'text-green-600' : 'text-yellow-600'}`}
          >
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

      {/* Clipboard Security Notice */}
      <div
        className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm"
        role="note"
        aria-label="Clipboard security notice"
      >
        <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-amber-800 space-y-1">
          <p className="font-semibold">Clipboard security notice</p>
          <p className="text-amber-700">
            If you copy any wallet data, your device&apos;s clipboard history may retain it. Any
            copied sensitive content is automatically cleared after{' '}
            {CLIPBOARD_TTL_MS / 1000} seconds. Avoid pasting wallet keys into untrusted
            applications.
          </p>
        </div>
      </div>

      {/* Export Form */}
      <form onSubmit={handleExport} className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">
            Wallet: <span className="font-normal text-gray-600">{wallet.label}</span>
          </p>

          {/* Public key row with explicit copy button */}
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-400 font-mono break-all flex-1">{wallet.publicKey}</p>
            <button
              type="button"
              aria-label="Copy public key"
              title="Copy public key to clipboard"
              onClick={handleCopyPublicKey}
              className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {copyState === 'copied' ? (
                <Check size={14} className="text-green-600" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>

          {/* Inline copy feedback */}
          {copyState === 'copied' && (
            <p className="text-xs text-green-600 mt-1" role="status">
              Copied! Will be cleared from clipboard in {CLIPBOARD_TTL_MS / 1000}s.
            </p>
          )}
          {copyState === 'error' && copyError && (
            <p className="text-xs text-red-600 mt-1" role="alert">
              {copyError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="wallet-backup-pin" className="block text-sm font-medium text-gray-700 mb-1">
            Enter your PIN to unlock backup
          </label>
          <div className="relative">
            <input
              id="wallet-backup-pin"
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Your wallet PIN…"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoComplete="current-password"
            />
            <button
              type="button"
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              onClick={() => setShowPin((s) => !s)}
              className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-r-md"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            role="alert"
          >
            <AlertTriangle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {exported && (
          <div
            className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
            role="status"
          >
            <CheckCircle size={15} />
            {serverBackupDone
              ? 'Backup downloaded and saved to server. Store the local file in a secure location as well.'
              : 'Backup downloaded. Store it in a secure location.'}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !pin}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Download size={16} />
          {loading ? 'Exporting…' : 'Export Encrypted Backup'}
        </button>
      </form>
    </div>
  );
}
