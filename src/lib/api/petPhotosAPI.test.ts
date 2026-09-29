import axios from 'axios';
import { mergePhotoUploadProgress, petPhotosAPI } from './petPhotosAPI';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: jest.fn() } },
  })),
}));

const api = (axios.create as jest.Mock).mock.results[0].value;

describe('petPhotosAPI.uploadPhotos progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.post.mockResolvedValue({ data: [] });
  });

  it('reports byte progress when the stream has no content length', async () => {
    const onProgress = jest.fn();
    const file = new File(['photo'], 'pet.png', { type: 'image/png' });

    await petPhotosAPI.uploadPhotos('pet-1', [file], onProgress);

    const config = api.post.mock.calls[0][2];
    config.onUploadProgress({ loaded: 1536 } as never);

    expect(onProgress).toHaveBeenCalledWith({ loadedBytes: 1536, totalBytes: undefined, percent: undefined });
  });

  it('reports percentage and bytes when the stream has a total', async () => {
    const onProgress = jest.fn();
    const file = new File(['photo'], 'pet.png', { type: 'image/png' });

    await petPhotosAPI.uploadPhotos('pet-1', [file], onProgress);

    const config = api.post.mock.calls[0][2];
    config.onUploadProgress({ loaded: 25, total: 100 } as never);

    expect(onProgress).toHaveBeenCalledWith({ loadedBytes: 25, totalBytes: 100, percent: 25 });
  });

  it('forwards a stable key for retries and the current attempt signal', async () => {
    const file = new File(['photo'], 'pet.png', { type: 'image/png' });
    const controller = new AbortController();

    await petPhotosAPI.uploadPhotos('pet-1', [file], undefined, controller.signal, 'batch-key');

    const config = api.post.mock.calls[0][2];
    expect(config.signal).toBe(controller.signal);
    expect(config.headers['Idempotency-Key']).toBe('batch-key');
  });

  it('keeps byte and percentage progress monotonic across retries or out-of-order events', () => {
    const afterFirstAttempt = { loadedBytes: 800, totalBytes: 1000, percent: 80 };
    const afterRetryEvent = mergePhotoUploadProgress(afterFirstAttempt, {
      loadedBytes: 240,
      totalBytes: 1000,
      percent: 24,
    });
    const unknownTotal = mergePhotoUploadProgress(afterRetryEvent, {
      loadedBytes: 900,
      totalBytes: undefined,
      percent: undefined,
    });

    expect(afterRetryEvent.loadedBytes).toBe(800);
    expect(afterRetryEvent.percent).toBe(80);
    expect(unknownTotal.loadedBytes).toBe(900);
    expect(unknownTotal.percent).toBe(80);
  });
});