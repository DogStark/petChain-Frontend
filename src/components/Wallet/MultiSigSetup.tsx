import React, { useState, useMemo } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle, Eye, EyeOff, Info } from 'lucide-react';
import type {
  WalletAccount,
  MultiSigConfig,
  WalletSigner,
  BroadcastResult,
  WalletMonitoringData,
} from '../../types/wallet';
import {
  validateMultisigConfig,
  buildConfigSummary,
  type ValidationWarning,
} from '../../utils/multisigValidation';

interface Props {
  wallet: WalletAccount | null;
  accountData: WalletMonitoringData | null;
  onSetupMultiSig: (pin: string, config: MultiSigConfig) => Promise<BroadcastResult>;
  onRemoveSigner: (pin: string, signerPublicKey: string) => Promise<BroadcastResult>;
  loading: boolean;
  error: string | null;
  onClearError: () => void;
}

const STELLAR_KEY_LENGTH = 56;
const STELLAR_KEY_PREFIX = 'G';
const MAX_WEIGHT = 255;

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
  const [showConfirm, setShowConfirm] = useState(false);

  if (!wallet) {
    return (
      <div className="text-center py-12 text-gray-400">Select a wallet to configure multi-sig.</div>
    );
  }

  const existingSigners =
    accountData?.signers.filter((s) => s.publicKey !== wallet.publicKey) ?? [];

  const validation = useMemo(() => {
    if (!wallet) return { errors: [], warnings: [] };
    return validateMultisigConfig(
      signers,
      masterWeight,
      lowThreshold,
      medThreshold,
      highThreshold,
      wallet.publicKey,
      accountData,
    );
  }, [signers, masterWeight, lowThreshold, medThreshold, highThreshold, wallet.publicKey, accountData]);

  const configSummary = useMemo(
    () => buildConfigSummary(signers, masterWeight, lowThreshold, medThreshold, highThreshold),
    [signers, masterWeight, lowThreshold, medThreshold, highThreshold],
  );

  const totalWeight = signers.reduce((sum, s) => sum + (s.weight || 0), 0) + masterWeight;

  function addSigner() {
    setSigners((prev) => [...prev, { publicKey: '', weight: 1 }]);
  }

  function removeSigner(idx: number) {
    setSigners((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSigner(idx: number, field: keyof WalletSigner, value: string | number) {
    setSigners((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  function hasKeyError(idx: number): boolean {
    const pk = signers[idx]?.publicKey;
    if (!pk) return false;
    if (!pk.startsWith(STELLAR_KEY_PREFIX) || pk.length !== STELLAR_KEY_LENGTH) return true;
    if (pk === wallet?.publicKey) return true;
    const dupCount = signers.filter((s) => s.publicKey.trim() === pk.trim()).length;
    if (dupCount > 1) return true;
    if (
      accountData?.signers.some(
        (s) => s.publicKey === pk && s.publicKey !== wallet?.publicKey,
      )
    )
      return true;
    return false;
  }

  function handleInitiateSetup(e: React.FormEvent) {
    e.preventDefault();
    onClearError();
    if (validation.errors.length > 0 || !pin) return;
    setShowConfirm(true);
  }

  async function handleConfirmSetup() {
    onClearError();
    setShowConfirm(false);
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

  const duplicateWarningFor = (idx: number): string | null => {
    const pk = signers[idx]?.publicKey?.trim();
    if (!pk) return null;
    const dupCount = signers.filter((s) => s.publicKey.trim() === pk).length;
    if (dupCount > 1) return 'Duplicate key — each signer must be unique.';
    if (
      accountData?.signers.some(
        (s) => s.publicKey === pk && s.publicKey !== wallet?.publicKey,
      )
    )
      return 'This key already exists on-chain as a co-signer.';
    return null;
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-4 text-sm text-purple-800">
        <p className="font-semibold flex items-center gap-1.5 mb-1">
          <Info size={15} /> Multi-Signature Wallets
        </p>
        <p>
          Add co-signers to require multiple parties to approve transactions. Set thresholds to
          control how many signature weights are needed for low, medium (payments), and high
          (account changes) operations.
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
            <label className="block text-xs font-medium text-gray-600 mb-1">
              PIN to remove signers
            </label>
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
      <form
        onSubmit={handleInitiateSetup}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-5"
      >
        <h3 className="font-semibold text-gray-900">Configure Multi-Sig</h3>

        {/* Validation Errors */}
        {validation.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <p className="font-medium mb-1">Please fix the following:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation Warnings */}
        {validation.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
            <p className="font-medium mb-1">Warnings:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {validation.warnings.map((w: ValidationWarning, i: number) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Co-signers */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Co-Signers</label>
          {signers.map((signer, idx) => {
            const dupMsg = duplicateWarningFor(idx);
            return (
              <div key={idx} className="space-y-1">
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={signer.publicKey}
                      onChange={(e) => updateSigner(idx, 'publicKey', e.target.value.trim())}
                      placeholder="G... (Stellar public key)"
                      aria-invalid={hasKeyError(idx)}
                      aria-describedby={dupMsg ? `signer-dup-${idx}` : undefined}
                      className={`w-full px-3 py-2 border rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        hasKeyError(idx) ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <input
                    type="number"
                    value={signer.weight}
                    min={0}
                    max={MAX_WEIGHT}
                    onChange={(e) => updateSigner(idx, 'weight', parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    title="Weight"
                    aria-label={`Weight for signer ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeSigner(idx)}
                    className="p-2 text-gray-400 hover:text-red-500 mt-0.5"
                    aria-label={`Remove signer ${idx + 1}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {dupMsg && (
                  <p id={`signer-dup-${idx}`} className="text-xs text-red-600 pl-1">
                    {dupMsg}
                  </p>
                )}
              </div>
            );
          })}
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Master Weight</label>
            <input
              type="number"
              value={masterWeight}
              min={0}
              max={MAX_WEIGHT}
              onChange={(e) => setMasterWeight(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Low Threshold</label>
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
          Total available weight: <strong>{totalWeight}</strong>. Payments require{' '}
          <strong>{medThreshold}</strong> — ensure your signers can meet the threshold.
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
          disabled={loading || validation.errors.length > 0 || !pin}
          className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Submitting transaction…' : 'Apply Multi-Sig Configuration'}
        </button>
      </form>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900">
              Confirm Multi-Sig Configuration
            </h2>
            <p className="text-sm text-gray-600">
              You are about to change the multi-signature configuration for this wallet. This will
              modify the signing requirements on-chain.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              {configSummary.map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.label}</span>
                  <span className={`font-medium ${item.highlight ? 'text-purple-700' : 'text-gray-900'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {validation.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                <p className="font-medium mb-1">Warnings:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {validation.warnings.map((w: ValidationWarning, i: number) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 space-y-1">
              <p className="font-medium">Risk reminders:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>This will change your wallet's signing requirements on-chain.</li>
                <li>Existing co-signers will be affected immediately.</li>
                <li>Ensure your signing parties can meet the new thresholds.</li>
              </ol>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmSetup}
                disabled={loading}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Applying...' : 'Apply Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
