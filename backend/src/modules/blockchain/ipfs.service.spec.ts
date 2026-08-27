import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IPFSService } from './ipfs.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockClient = {
  add: jest.fn(),
  cat: jest.fn(),
};

// Mock kubo-rpc-client dynamic import
jest.mock(
  'kubo-rpc-client',
  () => ({ create: () => mockClient }),
  { virtual: true },
);

describe('IPFSService', () => {
  let service: IPFSService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IPFSService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                'blockchain.ipfs.url': 'http://localhost:5001',
                'blockchain.ipfs.pinataApiKey': 'test-key',
                'blockchain.ipfs.pinataSecretKey': 'test-secret',
                'blockchain.ipfs.pinataGateway': 'https://gateway.pinata.cloud/ipfs/',
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();
    service = module.get(IPFSService);
    // Resolve the client promise with mock
    (service as any).clientPromise = Promise.resolve(mockClient);
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('uploads via primary on first attempt', async () => {
      mockClient.add.mockResolvedValue({ path: 'Qm123' });
      const cid = await service.upload(Buffer.from('data'));
      expect(cid).toBe('Qm123');
      expect(mockClient.add).toHaveBeenCalledTimes(1);
    });

    it('retries on failure then succeeds', async () => {
      mockClient.add
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue({ path: 'Qm456' });
      const cid = await service.upload(Buffer.from('data'), 3);
      expect(cid).toBe('Qm456');
      expect(mockClient.add).toHaveBeenCalledTimes(2);
    });

    it('falls back to Pinata after all retries fail', async () => {
      mockClient.add.mockRejectedValue(new Error('node down'));
      mockedAxios.post = jest.fn().mockResolvedValue({ data: { IpfsHash: 'QmPinata' } });
      const cid = await service.upload(Buffer.from('data'), 2);
      expect(cid).toBe('QmPinata');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('retrieve', () => {
    it('retrieves via primary node', async () => {
      async function* gen() { yield Buffer.from('hello'); }
      mockClient.cat.mockReturnValue(gen());
      const result = await service.retrieve('Qm123');
      expect(result).toBe('hello');
    });

    it('falls back to Pinata gateway on primary failure', async () => {
      mockClient.cat.mockImplementation(() => { throw new Error('offline'); });
      mockedAxios.get = jest.fn().mockResolvedValue({ data: 'fallback-data' });
      const result = await service.retrieve('Qm123');
      expect(result).toBe('fallback-data');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://gateway.pinata.cloud/ipfs/Qm123',
      );
    });
  });

  describe('health', () => {
    it('returns ok when primary is up', async () => {
      mockClient.add.mockResolvedValue({ path: 'Qmhealth' });
      const result = await service.health();
      expect(result).toEqual({ status: 'ok', provider: 'kubo' });
    });

    it('returns degraded when primary down but Pinata up', async () => {
      mockClient.add.mockRejectedValue(new Error('down'));
      mockedAxios.get = jest.fn().mockResolvedValue({ data: { message: 'Congratulations!' } });
      const result = await service.health();
      expect(result).toEqual({ status: 'degraded', provider: 'pinata' });
    });

    it('returns down when both providers fail', async () => {
      mockClient.add.mockRejectedValue(new Error('down'));
      mockedAxios.get = jest.fn().mockRejectedValue(new Error('pinata down'));
      const result = await service.health();
      expect(result).toEqual({ status: 'down', provider: 'kubo' });
    });
  });
});
