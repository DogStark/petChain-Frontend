import React, { useState } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle, Eye, EyeOff, Info } from 'lucide-react';
import type { WalletAccount, MultiSigConfig, WalletSigner, BroadcastResult, WalletMonitoringData } from '../../types/wallet';

interface Props {
  wallet: WalletAccount | null;
  accountData: WalletMonitoringData | null;
  onSetupMultiSig: (pin: string, config: MultiSigConfig) => Promise<BroadcastResult>;
  onRemoveSigner: (pin: string, signerPublicKey: string) => Promise<BroadcastResult>;
  loading: boolean;
  error: string | null;
  onClearError: () => void;
}

const DEFAULT_CONFIG: MultiSigConfig = {
  signers: [],
  masterWeight: 1,
  lowThreshold: 1,
  medThreshold: 2,
  highThreshold: 2,
};

export default function MultiSigSetup({
  wallet,
  accountData,
  onSetupMultiSig,
  onRemoveSigner,
  loading,
  error,
  onClearError,
}: Props) {
  const [signers, setSigners] = useState<WalletSigner[]>([{ publicKey: '', weight: 1 }]);
  const [masterWeight, setMasterWeight] = useState(1);
  const [lowThreshold, setLowThreshold] = useState(1);
  const [medThreshold, setMedThreshold] = useState(2);
  const [highThreshold, setHighThreshold] = useState(2);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [removePin, setRemovePin] = useState('');
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  if (!wallet) {
    return <div className="text-center py-12 text-gray-400">Select a wallet to configure multi-sig.</div>;
  }

  const existingSigners = accountData?.signers.filter((s) => s.publicKey !== wallet.publicKey) ?? [];

  function addSigner() {
    setSigners((prev) => [...prev, { publicKey: '', weight: 1 }]);
  }

  function removeSigner(idx: number) {
    setSigners((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSigner(idx: number, field: keyof WalletSigner, value: string | number) {
    setSigners((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  }

  function validateSigners(): string | null {
    for (const s of signers) {
      if (!s.publicKey.trim()) return 'All signers must have a public key.';
      if (!s.publicKey.startsWith('G') || s.publicKey.length !== 56)
        return `"${s.publicKey.slice(0, 12)}…" is not a valid Stellar public key (must start with G, 56 chars).`;
      if (s.publicKey === wallet!.publicKey)
        return "Don't add your own key as a co-signer — adjust the master weight instead.";
      if (s.weight < 0 || s.weight > 255) return 'Signer weight must be between 0 and 255.';
    }
    if (medThreshold < lowThreshold) return 'Medium threshold must be ≥ low threshold.';
    if (highThreshold < medThreshold) return 'High threshold must be ≥ medium threshold.';
    if (!pin) return 'PIN required to sign the setup transaction.';
    return null;
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    onClearError();
    const err = validateSigners();
    if (err) {
      // Inline error display via hook's setError isn't accessible here, show locally
      setResult(null);
      alert(err);
      return;
    }
    try {
      const res = await onSetupMultiSig(pin, {
        signers: signers.filter((s) => s.publicKey.trim()),
        masterWeight,
        lowThreshold,
        medThreshold,
        highThreshold,
      });
      setResult(res);
      setPin('');
    } catch {
      // error shown via hook
    }
  }

  async function handleRemoveSigner(signerKey: string) {
    if (!removePin) return;
    setRemovingKey(signerKey);
    onClearError();
    try {
      await onRemoveSigner(removePin, signerKey);
      setRemovePin('');
      setRemovingKey(null);
    } catch {
      setRemovingKey(null);
    }
  }

  const totalWeight = signers.reduce((sum, s) => sum + (s.weight || 0), 0) + masterWeight;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-4 text-sm text-purple-800">
        <p className="font-semibold flex items-center gap-1.5 mb-1"><Info size={15} /> Multi-Signature Wallets</p>
        <p>
          Add co-signers to require multiple parties to approve transactions. Set thresholds to control
          how many signature weights are needed for low, medium (payments), and high (account changes) operations.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Multi-sig configured on-chain!</p>
            <p className="text-xs mt-0.5 font-mono break-all">Tx: {result.hash}</p>
          </div>
        </div>
      )}

      {/* Existing Signers */}
      {existingSigners.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Current Co-Signers</h3>
          <div className="space-y-3">
            {existingSigners.map((s) => (
              <div key={s.publicKey} className="flex items-center justify-between gap-3">
                <code className="text-xs text-gray-600 truncate">{s.publicKey}</code>
                <span className="text-xs bg-purple-50 text-purple-700 rounded-full px-2 py-0.5 flex-shrink-0">
                  w={s.weight}
                </span>
                <button
                  onClick={() => handleRemoveSigner(s.publicKey)}
                  disabled={loading || removingKey === s.publicKey}
                  className="text-red-400 hover:text-red-600 flex-shrink-0 disabled:opacity-40"
                  title="Remove signer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-600 mb-1">PIN to remove signers</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={removePin}
                onChange={(e) => setRemovePin(e.target.value)}
                placeholder="Your wallet PIN…"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Setup Form */}
      <form onSubmit={handleSetup} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-5">
        <h3 className="font-semibold text-gray-900">Configure Multi-Sig</h3>

        {/* Co-signers */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Co-Signers</label>
          {signers.map((signer, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  value={signer.publicKey}
                  onChange={(e) => updateSigner(idx, 'publicKey', e.target.value.trim())}
                  placeholder="G... (Stellar public key)"
                  className={`w-full px-3 py-2 border rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    signer.publicKey && (!signer.publicKey.startsWith('G') || signer.publicKey.length !== 56)
                      ? 'border-red-400'
                      : 'border-gray-300'
                  }`}
                />
              </div>
              <input
                type="number"
                value={signer.weight}
                min={0}
                max={255}
                onChange={(e) => updateSigner(idx, 'weight', parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                title="Weight"
              />
              <button
                type="button"
                onClick={() => removeSigner(idx)}
                className="p-2 text-gray-400 hover:text-red-500 mt-0.5"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addSigner}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus size={15} /> Add signer
          </button>
        </div>

        {/* Thresholds */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Master Weight
            </label>
            <input
              type="number"
              value={masterWeight}
              min={0} max={255}
              onChange={(e) => setMasterWeight(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Low Threshold
            </label>
            <input
              type="number"
              value={lowThreshold}
              min={0}
              onChange={(e) => setLowThreshold(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Medium Threshold <span className="text-gray-400">(payments)</span>
            </label>
            <input
              type="number"
              value={medThreshold}
              min={0}
              onChange={(e) => setMedThreshold(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              High Threshold <span className="text-gray-400">(account changes)</span>
            </label>
            <input
              type="number"
              value={highThreshold}
              min={0}
              onChange={(e) => setHighThreshold(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Weight summary */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-600">
          Total available weight: <strong>{totalWeight}</strong>.
          Payments require <strong>{medThreshold}</strong> — ensure your signers can meet the threshold.
        </div>

        {/* PIN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Wallet PIN</label>
          <div className="relative">
            <input
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN to sign setup transaction…"
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          disabled={loading}
          className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Submitting transaction…' : 'Apply Multi-Sig Configuration'}
        </button>
      </form>
    </div>
  );
}
