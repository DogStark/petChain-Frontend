export interface ZkpProof {
  id: string;
  vaccinationId: string;
  petId: string;
  publicInputs: {
    petId: string;
    vaccineName: string;
    isValid: boolean;
    expiresAfter: string | null;
  };
  proof: string;
  isValid: boolean;
  expiresAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface VerifyResult {
  valid: boolean;
  publicInputs: ZkpProof['publicInputs'];
}

export const zkpService = {
  async generateProof(vaccinationId: string, expiresAt?: string): Promise<ZkpProof> {
    const res = await fetch('/api/zkp/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaccinationId, expiresAt }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async verifyProof(proofId: string): Promise<VerifyResult> {
    const res = await fetch('/api/zkp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proofId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getProofsForPet(petId: string): Promise<ZkpProof[]> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/zkp/pet/${petId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
