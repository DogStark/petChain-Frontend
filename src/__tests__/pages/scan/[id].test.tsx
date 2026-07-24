import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ScanPage from '@/pages/scan/[id]';
import { qrcodeAPI, type QRCodeRecord } from '@/lib/api/qrcodeAPI';
import { petAPI } from '@/lib/api/petAPI';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { id: 'tag-1' },
    push: jest.fn(),
  }),
}));

jest.mock('@/lib/api/qrcodeAPI', () => ({
  qrcodeAPI: {
    getOne: jest.fn(),
    recordScan: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/api/petAPI', () => ({
  petAPI: {
    getPetEmergencyInfo: jest.fn(),
  },
}));

const activeTag: QRCodeRecord = {
  id: 'record-1',
  petId: 'pet-1',
  qrCodeId: 'tag-1',
  isActive: true,
  scanCount: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ScanPage (public emergency scan)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (qrcodeAPI.recordScan as jest.Mock).mockResolvedValue(undefined);
    (petAPI.getPetEmergencyInfo as jest.Mock).mockRejectedValue(new Error('not needed'));
  });

  // Regression test for the page being frozen at first-scan state via
  // revalidate:false — every render must reflect the tag's current status,
  // so a tag deactivated after the first scan must show as deactivated,
  // not stale "active" content, on the very next scan.
  it('shows the deactivated state when the tag is inactive, not stale cached content', async () => {
    (qrcodeAPI.getOne as jest.Mock).mockResolvedValue({ ...activeTag, isActive: false });

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByText(/deactivated by the owner/i)).toBeInTheDocument();
    });
  });

  it('renders emergency info for an active tag', async () => {
    (qrcodeAPI.getOne as jest.Mock).mockResolvedValue(activeTag);

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByText(/Emergency Record/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/deactivated by the owner/i)).not.toBeInTheDocument();
  });

  it('re-fetches the tag on every mount instead of relying on cached props', async () => {
    (qrcodeAPI.getOne as jest.Mock).mockResolvedValue(activeTag);

    const { unmount } = render(<ScanPage />);
    await waitFor(() => expect(qrcodeAPI.getOne).toHaveBeenCalledTimes(1));
    unmount();

    render(<ScanPage />);
    await waitFor(() => expect(qrcodeAPI.getOne).toHaveBeenCalledTimes(2));
  });
});
