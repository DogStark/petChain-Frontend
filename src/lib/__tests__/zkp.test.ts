import { describe, it, expect } from 'vitest';
import {
  generateVaccinationProof,
  verifyVaccinationProof,
  serializeProof,
  deserializeProof,
} from '../zkp';

/**
 * Deterministic ZKP interoperability test vectors.
 *
 * These fixtures are synthetic and contain no real pet, medical, contact,
 * wallet, or credential data. They pin the proof generation, serialization,
 * tamper rejection, and version migration behavior so that generated
 * vaccination proofs remain compatible across releases.
 */

const FIXED_TIMESTAMP = 1700000000000;

const VECTOR_INPUT = {
  petId: 'test-pet-0001',
  vaccineType: 'rabies',
  vaccinationDate: '2023-01-15',
  issuerId: 'test-issuer-0001',
  nonce: '0000000000000000000000000000000000000000000000000000000000000001',
};

const EXPECTED_SERIALIZED_PROOF =
  '{"version":1,"proof":"deadbeef","publicSignals":["1","2","3"]}';

describe('ZKP interoperability vectors', () => {
  it('generates a deterministic proof for a fixed input', async () => {
    const first = await generateVaccinationProof(VECTOR_INPUT, {
      timestamp: FIXED_TIMESTAMP,
    });
    const second = await generateVaccinationProof(VECTOR_INPUT, {
      timestamp: FIXED_TIMESTAMP,
    });

    expect(first).toEqual(second);
    expect(serializeProof(first)).toBe(EXPECTED_SERIALIZED_PROOF);
  });

  it('round-trips a generated proof through serialization', async () => {
    const proof = await generateVaccinationProof(VECTOR_INPUT, {
      timestamp: FIXED_TIMESTAMP,
    });

    const serialized = serializeProof(proof);
    const restored = deserializeProof(serialized);

    expect(restored).toEqual(proof);
    expect(serializeProof(restored)).toBe(serialized);
  });

  it('accepts a valid proof', async () => {
    const proof = await generateVaccinationProof(VECTOR_INPUT, {
      timestamp: FIXED_TIMESTAMP,
    });

    await expect(verifyVaccinationProof(proof)).resolves.toBe(true);
  });

  it('rejects a proof with tampered proof bytes', async () => {
    const proof = await generateVaccinationProof(VECTOR_INPUT, {
      timestamp: FIXED_TIMESTAMP,
    });

    const tampered = { ...proof, proof: 'deadbeee' };
    await expect(verifyVaccinationProof(tampered)).resolves.toBe(false);
  });

  it('rejects a proof with tampered public signals', async () => {
    const proof = await generateVaccinationProof(VECTOR_INPUT, {
      timestamp: FIXED_TIMESTAMP,
    });

    const tampered = {
      ...proof,
      publicSignals: [...proof.publicSignals.slice(0, -1), '999'],
    };
    await expect(verifyVaccinationProof(tampered)).resolves.toBe(false);
  });

  it('rejects a proof with a mismatched version', async () => {
    const proof = await generateVaccinationProof(VECTOR_INPUT, {
      timestamp: FIXED_TIMESTAMP,
    });

    const tampered = { ...proof, version: 999 };
    await expect(verifyVaccinationProof(tampered)).resolves.toBe(false);
  });

  it('migrates a legacy serialized proof to the current version', () => {
    const legacy = JSON.stringify({
      version: 0,
      proof: 'deadbeef',
      publicSignals: ['1', '2', '3'],
    });

    const migrated = deserializeProof(legacy);

    expect(migrated.version).toBe(1);
    expect(migrated.proof).toBe('deadbeef');
    expect(migrated.publicSignals).toEqual(['1', '2', '3']);
  });
});
