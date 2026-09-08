import { zkpService, ZkpProof, VerifyResult } from './zkp';

const mockProof: ZkpProof = {
  id: 'proof-1',
  vaccinationId: 'vac-1',
  petId: 'pet-1',
  publicInputs: { petId: 'pet-1', vaccineName: 'Rabies', isValid: true, expiresAfter: null },
  proof: 'abc123',
  isValid: true,
  expiresAt: null,
  verifiedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
};

const mockVerifyResult: VerifyResult = {
  valid: true,
  publicInputs: mockProof.publicInputs,
};

describe('zkpService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('generateProof', () => {
    it('returns a ZkpProof on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProof,
      });

      const result = await zkpService.generateProof('vac-1');

      expect(result).toEqual(mockProof);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/zkp/generate',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('throws on a 4xx response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Vaccination not found',
      });

      await expect(zkpService.generateProof('bad-id')).rejects.toThrow('Vaccination not found');
    });

    it('throws on a 5xx response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Internal server error',
      });

      await expect(zkpService.generateProof('vac-1')).rejects.toThrow('Internal server error');
    });
  });

  describe('verifyProof', () => {
    it('returns a VerifyResult on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVerifyResult,
      });

      const result = await zkpService.verifyProof('proof-1');

      expect(result).toEqual(mockVerifyResult);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/zkp/verify',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('throws on a 4xx response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Proof not found',
      });

      await expect(zkpService.verifyProof('bad-proof')).rejects.toThrow('Proof not found');
    });

    it('throws on a 5xx response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Service unavailable',
      });

      await expect(zkpService.verifyProof('proof-1')).rejects.toThrow('Service unavailable');
    });
  });
});
