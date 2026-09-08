import axios from 'axios';
import { QRCodeAPI } from '@/lib/api/qrcodeAPI';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

describe('QRCodeAPI privacy-safe scan metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('drops personal and precise location fields before sending a scan event', async () => {
    const post = jest.fn().mockResolvedValue({ data: {} });
    const use = jest.fn();

    (axios.create as jest.Mock).mockReturnValue({
      post,
      interceptors: {
        request: { use },
      },
    });

    const api = new QRCodeAPI();

    await api.recordScan('tag-1', {
      deviceType: 'mobile',
      city: 'Tokyo',
      country: 'JP',
      latitude: 35.6895,
      longitude: 139.6917,
      userAgent: 'Mozilla/5.0',
      ipAddress: '203.0.113.42',
      emergencyContact: '+1-555-0100',
    } as any);

    expect(post).toHaveBeenCalledWith('/tag-1/scan', {
      deviceType: 'mobile',
    });
  });
});
