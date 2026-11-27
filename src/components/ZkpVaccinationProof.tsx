'use client';

import { useEffect, useState } from 'react';
import { useZkp } from '@/hooks/useZkp';
import type { ZkpProof, VerifyResult } from '@/lib/zkp';
import { formatDate } from '@/utils/formatDate';

interface Props {
  vaccinationId: string;
  vaccineName: string;
  existingProof?: ZkpProof;
  proofStatusUnavailable?: boolean;
}

export default function ZkpVaccinationProof({
  vaccinationId,
  vaccineName,
  existingProof,
  proofStatusUnavailable = false,
}: Props) {
  const { generateProof, verifyProof, isGenerating, isVerifying, error } = useZkp();
  const [proof, setProof] = useState<ZkpProof | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [handlerError, setHandlerError] = useState<string | null>(null);

  useEffect(() => {
    setProof(existingProof ?? null);
    setVerifyResult(null);
  }, [existingProof]);

  const handleGenerate = async () => {
    setHandlerError(null);
    try {
      const result = await generateProof(vaccinationId);
      if (result) {
        setProof(result);
        setVerifyResult(null);
      }
    } catch (e) {
      setHandlerError(e instanceof Error ? e.message : 'Failed to generate proof');
    }
  };

  const handleVerify = async () => {
    if (!proof) return;
    setHandlerError(null);
    try {
      const result = await verifyProof(proof.id);
      if (result) setVerifyResult(result);
    } catch (e) {
      setHandlerError(e instanceof Error ? e.message : 'Failed to verify proof');
    }
  };

  const displayError = handlerError ?? error;
  const isVerified =
    verifyResult?.valid ?? Boolean(proof?.isValid && proof.verifiedAt);
  const proofDetailsId = `vaccination-proof-${vaccinationId}`;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">ZK Proof — {vaccineName}</h3>
        <span
          title="ZKP verification checks vaccination validity without revealing sensitive medical details."
          aria-label="ZKP verification checks vaccination validity without revealing sensitive medical details"
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            proofStatusUnavailable
              ? 'bg-gray-100 text-gray-700'
              : isVerified
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
          }`}
        >
          {proofStatusUnavailable
            ? 'Status unavailable'
            : isVerified
              ? 'Verified'
              : 'Unverified'}
        </span>
      </div>

      <a
        href={`#${proofDetailsId}`}
        className="text-sm font-medium text-blue-700 underline"
      >
        View proof details
      </a>

      <div id={proofDetailsId} className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
        {proofStatusUnavailable ? (
          <p>Proof status could not be loaded.</p>
        ) : proof ? (
          <>
            <p>Proof ID: <span className="break-all font-mono">{proof.id}</span></p>
            <p className="mt-1">Status: {isVerified ? 'Verified on-chain' : 'Not verified'}</p>
            {proof.expiresAt && <p className="mt-1">Expires: {formatDate(proof.expiresAt)}</p>}
          </>
        ) : (
          <p>No ZKP proof is associated with this vaccination.</p>
        )}
      </div>

      {displayError && (
        <div
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2"
        >
          {displayError}
        </div>
      )}

      {verifyResult && (
        <div
          className={`rounded-lg p-3 text-sm ${verifyResult.valid ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}
        >
          {verifyResult.valid
            ? '✓ Proof verified — vaccination is valid'
            : '✗ Proof invalid or expired'}
          <div className="mt-1 text-xs opacity-75">
            Vaccine: {verifyResult.publicInputs.vaccineName} · Valid:{' '}
            {String(verifyResult.publicInputs.isValid)}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || isVerifying}
          className="flex-1 py-2 px-3 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
        >
          {isGenerating ? 'Generating…' : proof ? 'Generate New Proof' : 'Generate Proof'}
        </button>
        {proof && (
          <button
            onClick={handleVerify}
            disabled={isGenerating || isVerifying}
            className="flex-1 py-2 px-3 text-sm rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
          >
            {isVerifying ? 'Verifying…' : 'Verify Proof'}
          </button>
        )}
      </div>
    </div>
  );
}
