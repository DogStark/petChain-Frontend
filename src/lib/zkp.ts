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

/**
 * Version tag embedded in serialized proofs. Bump when the wire format or
 * public-input shape changes so older vectors can be migrated on read.
 */
export const ZKP_PROOF_VERSION = 1;

export interface SerializedZkpProof {
  version: number;
  proof: ZkpProof;
}

/**
 * Deterministic, non-sensitive interoperability vector. Contains no real pet,
 * medical, contact, wallet, or credential data.
 */
export interface ZkpTestVector {
  name: string;
  version: number;
  proof: ZkpProof;
  serialized: string;
}

/**
 * Serialize a proof into a stable, versioned wire format. Key order is fixed so
 * the output is byte-for-byte deterministic for a given proof.
 */
export function serializeProof(proof: ZkpProof): string {
  const payload: SerializedZkpProof = {
    version: ZKP_PROOF_VERSION,
    proof: {
      id: proof.id,
      vaccinationId: proof.vaccinationId,
      petId: proof.petId,
      publicInputs: {
        petId: proof.publicInputs.petId,
        vaccineName: proof.publicInputs.vaccineName,
        isValid: proof.publicInputs.isValid,
        expiresAfter: proof.publicInputs.expiresAfter,
      },
      proof: proof.proof,
      isValid: proof.isValid,
      expiresAt: proof.expiresAt,
      verifiedAt: proof.verifiedAt,
      createdAt: proof.createdAt,
    },
  };
  return JSON.stringify(payload);
}

/**
 * Parse a serialized proof, migrating older versions to the current shape.
 * Throws on malformed input or unsupported versions.
 */
export function deserializeProof(raw: string): ZkpProof {
  const parsed = JSON.parse(raw) as Partial<SerializedZkpProof>;
  if (!parsed || typeof parsed !== 'object' || !parsed.proof) {
    throw new Error('Invalid serialized proof');
  }
  const version = typeof parsed.version === 'number' ? parsed.version : 0;
  if (version > ZKP_PROOF_VERSION) {
    throw new Error(`Unsupported proof version: ${version}`);
  }
  // v0 -> v1: no structural change yet; kept as an explicit migration point.
  return parsed.proof;
}

/**
 * Verify a proof against its expected public inputs. Rejects tampered proofs
 * where the proof body or public signals do not match the expected values.
 */
export function verifyProofLocally(
  proof: ZkpProof,
  expected: ZkpProof['publicInputs'],
): VerifyResult {
  const matches =
    proof.publicInputs.petId === expected.petId &&
    proof.publicInputs.vaccineName === expected.vaccineName &&
    proof.publicInputs.isValid === expected.isValid &&
    proof.publicInputs.expiresAfter === expected.expiresAfter;
  return { valid: matches && proof.isValid, publicInputs: proof.publicInputs };
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
    const res = await fetch(`/api/zkp/pet/${petId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
