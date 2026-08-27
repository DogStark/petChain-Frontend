import { act, renderHook } from '@testing-library/react';
import { useBlockchainSync } from './useBlockchainSync';
import { stellarSync } from '@/lib/blockchain/stellarSync';

jest.mock('@/lib/blockchain/stellarSync', () => ({
  stellarSync: {
    syncRecord: jest.fn(),
    verifyRecord: jest.fn(),
    getSyncStatus: jest.fn(),
    getAllSyncStatuses: jest.fn(),
  },
}));

jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    fromSecret: jest.fn(() => ({ publicKey: () => 'FAKE_PUBLIC_KEY' })),
  },
}));

describe('useBlockchainSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (stellarSync.getAllSyncStatuses as jest.Mock).mockReturnValue([]);
  });

  it('sets an error state and does not throw when a sync fails', async () => {
    (stellarSync.syncRecord as jest.Mock).mockRejectedValueOnce(new Error('Horizon unreachable'));

    const { result } = renderHook(() => useBlockchainSync());

    await act(async () => {
      await expect(
        result.current.syncRecord(
          {
            id: 'rec-001',
            petId: 'pet-001',
            type: 'vaccination',
            critical: true,
            data: { vaccine: 'Rabies' },
          },
          'SECRET',
          'ENC'
        )
      ).resolves.toBeUndefined();
    });

    expect(result.current.syncError).toBe('Horizon unreachable');
    expect(result.current.isLoading).toBe(false);
  });
});
