import { useState, useCallback } from 'react';
import { zkpService, ZkpProof, VerifyResult } from '@/lib/zkp';

export function useZkp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateProof = useCallback(async (vaccinationId: string, expiresAt?: string): Promise<ZkpProof | null> => {
    setLoading(true);
    setError(null);
    try {
      return await zkpService.generateProof(vaccinationId, expiresAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate proof');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyProof = useCallback(async (proofId: string): Promise<VerifyResult | null> => {
    setLoading(true);
    setError(null);
    try {
      return await zkpService.verifyProof(proofId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to verify proof');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateProof, verifyProof, loading, error };
}
