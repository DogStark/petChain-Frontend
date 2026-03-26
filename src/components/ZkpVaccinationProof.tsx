'use client';

import { useState } from 'react';
import { useZkp } from '@/hooks/useZkp';
import { ZkpProof, VerifyResult } from '@/lib/zkp';

interface Props {
  vaccinationId: string;
  vaccineName: string;
}

export default function ZkpVaccinationProof({ vaccinationId, vaccineName }: Props) {
  const { generateProof, verifyProof, loading, error } = useZkp();
  const [proof, setProof] = useState<ZkpProof | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const handleGenerate = async () => {
    const result = await generateProof(vaccinationId);
    if (result) {
      setProof(result);
      setVerifyResult(null);
    }
  };

  const handleVerify = async () => {
    if (!proof) return;
    const result = await verifyProof(proof.id);
    if (result) setVerifyResult(result);
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          ZK Proof — {vaccineName}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">Privacy-preserving</span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">
        Generate a cryptographic proof that this vaccination is valid without revealing sensitive medical details.
      </p>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
          {error}
        </div>
      )}

      {proof && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1 text-xs font-mono break-all">
          <p className="text-gray-500 dark:text-gray-400">Proof ID: <span className="text-gray-800 dark:text-gray-200">{proof.id}</span></p>
          <p className="text-gray-500 dark:text-gray-400">
            Status:{' '}
            <span className={proof.isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {proof.isValid ? 'Valid' : 'Revoked'}
            </span>
          </p>
          {proof.expiresAt && (
            <p className="text-gray-500 dark:text-gray-400">
              Expires: <span className="text-gray-800 dark:text-gray-200">{new Date(proof.expiresAt).toLocaleDateString()}</span>
            </p>
          )}
        </div>
      )}

      {verifyResult && (
        <div className={`rounded-lg p-3 text-sm ${verifyResult.valid ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
          {verifyResult.valid ? '✓ Proof verified — vaccination is valid' : '✗ Proof invalid or expired'}
          <div className="mt-1 text-xs opacity-75">
            Vaccine: {verifyResult.publicInputs.vaccineName} · Valid: {String(verifyResult.publicInputs.isValid)}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex-1 py-2 px-3 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating…' : 'Generate Proof'}
        </button>
        {proof && (
          <button
            onClick={handleVerify}
            disabled={loading}
            className="flex-1 py-2 px-3 text-sm rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
          >
            {loading ? 'Verifying…' : 'Verify Proof'}
          </button>
        )}
      </div>
    </div>
  );
}
