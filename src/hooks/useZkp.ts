import { useState, useCallback } from 'react';
import { zkpService, ZkpProof, VerifyResult } from '@/lib/zkp';

export function useZkp() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateProof = useCallback(
    async (vaccinationId: string, expiresAt?: string): Promise<ZkpProof | null> => {
      setIsGenerating(true);
      setError(null);
      try {
        return await zkpService.generateProof(vaccinationId, expiresAt);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to generate proof');
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  const verifyProof = useCallback(async (proofId: string): Promise<VerifyResult | null> => {
    setIsVerifying(true);
    setError(null);
    try {
      return await zkpService.verifyProof(proofId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to verify proof');
      return null;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  const loading = isGenerating || isVerifying;

  return { generateProof, verifyProof, isGenerating, isVerifying, loading, error };
}
