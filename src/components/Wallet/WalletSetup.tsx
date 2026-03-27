import React, { useState } from 'react';
import { Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';

interface Props {
  onCreateWallet: (label: string, pin: string) => Promise<void>;
  onImportWallet: (secretKey: string, label: string, pin: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  onClearError: () => void;
}

type Tab = 'create' | 'import';

const PIN_MIN_LENGTH = 6;

function PinInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Enter PIN…'}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function SecretKeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const isValid = value.startsWith('S') && value.length === 56;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
          className={`w-full px-3 py-2 pr-16 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            value && !isValid ? 'border-red-400' : 'border-gray-300 focus:border-blue-500'
          }`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {value &&
            (isValid ? (
              <CheckCircle size={14} className="text-green-500" />
            ) : (
              <AlertTriangle size={14} className="text-red-400" />
            ))}
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      {value && !isValid && (
        <p className="text-xs text-red-500 mt-1">
          Must start with &quot;S&quot; and be 56 characters (Stellar secret key format).
        </p>
      )}
    </div>
  );
}

export default function WalletSetup({
  onCreateWallet,
  onImportWallet,
  loading,
  error,
  onClearError,
}: Props) {
  const [tab, setTab] = useState<Tab>('create');

  // Create form
  const [createLabel, setCreateLabel] = useState('');
  const [createPin, setCreatePin] = useState('');
  const [createPinConfirm, setCreatePinConfirm] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);

  // Import form
  const [importLabel, setImportLabel] = useState('');
  const [importSecretKey, setImportSecretKey] = useState('');
  const [importPin, setImportPin] = useState('');
  const [importPinConfirm, setImportPinConfirm] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  function validateCreate(): string | null {
    if (!createLabel.trim()) return 'Please enter a wallet name.';
    if (createPin.length < PIN_MIN_LENGTH)
      return `PIN must be at least ${PIN_MIN_LENGTH} characters.`;
    if (createPin !== createPinConfirm) return 'PINs do not match.';
    return null;
  }

  function validateImport(): string | null {
    if (!importLabel.trim()) return 'Please enter a wallet name.';
    if (!importSecretKey.startsWith('S') || importSecretKey.length !== 56)
      return 'Invalid Stellar secret key format.';
    if (importPin.length < PIN_MIN_LENGTH)
      return `PIN must be at least ${PIN_MIN_LENGTH} characters.`;
    if (importPin !== importPinConfirm) return 'PINs do not match.';
    return null;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    onClearError();
    const err = validateCreate();
    if (err) return;
    try {
      await onCreateWallet(createLabel.trim(), createPin);
      setCreateSuccess(true);
      setCreateLabel('');
      setCreatePin('');
      setCreatePinConfirm('');
    } catch {
      // error is set by hook
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    onClearError();
    const err = validateImport();
    if (err) return;
    try {
      await onImportWallet(importSecretKey, importLabel.trim(), importPin);
      setImportSuccess(true);
      setImportLabel('');
      setImportSecretKey('');
      setImportPin('');
      setImportPinConfirm('');
    } catch {
      // error is set by hook
    }
  }

  return (
    <div className="max-w-lg">
      {/* Tab Switch */}
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {(['create', 'import'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              onClearError();
            }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'create' ? 'Create New' : 'Import Existing'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Security Notice */}
      <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <strong>Security:</strong> Your secret key is encrypted with AES-256-GCM using your PIN
        before being stored. The PIN is never stored — if you forget it, your key cannot be
        recovered.
      </div>

      {/* ── Create Form ─────────────────────────────────────── */}
      {tab === 'create' && (
        <form onSubmit={handleCreate} className="space-y-4">
          {createSuccess && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
              <CheckCircle size={16} />
              Wallet created! Make sure to back it up in the Backup tab.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Name</label>
            <input
              type="text"
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
              placeholder="e.g. My Pet Wallet"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <PinInput
            value={createPin}
            onChange={setCreatePin}
            label={`PIN (min ${PIN_MIN_LENGTH} chars)`}
          />
          <PinInput
            value={createPinConfirm}
            onChange={setCreatePinConfirm}
            label="Confirm PIN"
            placeholder="Re-enter PIN…"
          />
          {createPin && createPinConfirm && createPin !== createPinConfirm && (
            <p className="text-xs text-red-500">PINs do not match.</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generating keypair…' : 'Create Wallet'}
          </button>
        </form>
      )}

      {/* ── Import Form ─────────────────────────────────────── */}
      {tab === 'import' && (
        <form onSubmit={handleImport} className="space-y-4">
          {importSuccess && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
              <CheckCircle size={16} />
              Wallet imported successfully.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Name</label>
            <input
              type="text"
              value={importLabel}
              onChange={(e) => setImportLabel(e.target.value)}
              placeholder="e.g. Existing Wallet"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <SecretKeyInput value={importSecretKey} onChange={setImportSecretKey} />
          <PinInput
            value={importPin}
            onChange={setImportPin}
            label={`New PIN (min ${PIN_MIN_LENGTH} chars)`}
          />
          <PinInput
            value={importPinConfirm}
            onChange={setImportPinConfirm}
            label="Confirm PIN"
            placeholder="Re-enter PIN…"
          />
          {importPin && importPinConfirm && importPin !== importPinConfirm && (
            <p className="text-xs text-red-500">PINs do not match.</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Importing…' : 'Import Wallet'}
          </button>
        </form>
      )}
    </div>
  );
}
