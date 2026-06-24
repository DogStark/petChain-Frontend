import React, { useState, useRef } from 'react';
import { Upload, AlertTriangle, CheckCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import type { BackupData, WalletAccount } from '../../types/wallet';

interface Props {
  onImportBackup: (backup: BackupData, pin: string) => Promise<WalletAccount>;
  loading: boolean;
  error: string | null;
  onClearError: () => void;
}

export default function WalletRecovery({ onImportBackup, loading, error, onClearError }: Props) {
  const [backup, setBackup] = useState<BackupData | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [recovered, setRecovered] = useState<WalletAccount | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    onClearError();
    setParseError(null);
    setBackup(null);
    setRecovered(null);

    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as BackupData;
        // Basic structure check
        if (
          !parsed.publicKey ||
          !parsed.encryptedKey ||
          !parsed.iv ||
          !parsed.salt ||
          !parsed.checksum
        ) {
          throw new Error('Missing required backup fields.');
        }
        if (parsed.version !== 1) {
          throw new Error(`Unsupported backup version: ${parsed.version}`);
        }
        setBackup(parsed);
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : 'Invalid backup file — could not parse JSON.'
        );
      }
    };
    reader.readAsText(file);
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    if (!backup || !pin) return;
    onClearError();
    setParseError(null);

    try {
      const wallet = await onImportBackup(backup, pin);
      setRecovered(wallet);
      setBackup(null);
      setFileName('');
      setPin('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      // Translate crypto error to user-friendly message
      if (
        err instanceof Error &&
        (err.message.includes('decrypt') || err.message.includes('operation'))
      ) {
        setParseError('Incorrect PIN. The backup cannot be decrypted with this PIN.');
      }
      // other errors shown via hook
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
        <p className="font-semibold flex items-center gap-1.5 mb-1">
          <ShieldCheck size={15} /> Wallet Recovery
        </p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>
            Upload the <code>.json</code> backup file you exported earlier.
          </li>
          <li>Enter the PIN you used when exporting.</li>
          <li>The checksum is verified before decryption to detect tampering.</li>
          <li>Your secret key is re-encrypted with the same PIN and stored locally.</li>
        </ul>
      </div>

      {recovered && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Wallet recovered successfully</p>
            <p className="text-xs text-green-600 mt-0.5">{recovered.label}</p>
            <p className="text-xs font-mono text-gray-500 mt-1 break-all">{recovered.publicKey}</p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleRecover}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-5"
      >
        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Backup File</label>
          <div
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl px-6 py-8 text-center transition-colors ${
              backup
                ? 'border-green-400 bg-green-50'
                : parseError
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            {backup ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle size={28} className="text-green-500" />
                <p className="text-sm font-medium text-green-700">{fileName}</p>
                <p className="text-xs text-green-600">
                  Public key: {backup.publicKey.slice(0, 12)}…{backup.publicKey.slice(-6)}
                </p>
                <p className="text-xs text-gray-400">
                  {backup.network} · {backup.label}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={28} className="text-gray-400" />
                <p className="text-sm text-gray-500">
                  {fileName ? fileName : 'Click to select backup file'}
                </p>
                <p className="text-xs text-gray-400">.json format</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        {parseError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
            <AlertTriangle size={15} className="flex-shrink-0" /> {parseError}
          </div>
        )}

        {error && !parseError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
            <AlertTriangle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}

        {/* PIN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Backup PIN</label>
          <div className="relative">
            <input
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="The PIN used when backup was created…"
              disabled={!backup}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
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

        <button
          type="submit"
          disabled={loading || !backup || !pin}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <ShieldCheck size={16} />
          {loading ? 'Verifying & restoring…' : 'Restore Wallet'}
        </button>
      </form>
    </div>
  );
}
