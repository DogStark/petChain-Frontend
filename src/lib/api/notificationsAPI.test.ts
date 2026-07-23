import axios from 'axios';
import { DEFAULT_PREFERENCES } from '@/types/notification';

jest.mock('axios', () => {
  const mockInstance = {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: jest.fn() } },
  };
  return {
    __esModule: true,
    default: { create: jest.fn(() => mockInstance) },
  };
});

import { notificationsAPI } from './notificationsAPI';

const mockAxiosInstance = (axios.create as jest.Mock).mock.results[0].value;

describe('notificationsAPI preferences persistence', () => {
  beforeEach(() => {
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.patch.mockReset();
  });

  it('merges backend category settings onto the cached preferences fallback', async () => {
    mockAxiosInstance.get.mockResolvedValue({
      data: { appointment: false, medication: true, lostPet: false },
    });

    const result = await notificationsAPI.getPreferences('user-1', DEFAULT_PREFERENCES);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user-1/settings');
    expect(result.categories.APPOINTMENT).toBe(false);
    expect(result.categories.MEDICATION).toBe(true);
    expect(result.categories.LOST_PET).toBe(false);
    // Fields the backend doesn't return/store fall back to the cached value.
    expect(result.categories.SYSTEM).toBe(DEFAULT_PREFERENCES.categories.SYSTEM);
    expect(result.sound).toBe(DEFAULT_PREFERENCES.sound);
    expect(result.dndStart).toBe(DEFAULT_PREFERENCES.dndStart);
  });

  it('sends the category booleans to the settings endpoint on update', async () => {
    mockAxiosInstance.patch.mockResolvedValue({ data: {} });

    await notificationsAPI.updatePreferences('user-1', DEFAULT_PREFERENCES);

    expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
      '/user-1/settings',
      expect.objectContaining({
        appointment: true,
        medication: true,
        consultation: true,
        alert: true,
        message: true,
        vaccination: true,
        lostPet: true,
        medicalRecord: true,
        system: true,
      })
    );
  });
});
