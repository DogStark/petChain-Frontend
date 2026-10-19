import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { petAPI } from '@/lib/api/petAPI';
import { qrcodeAPI, type QRCodeRecord } from '@/lib/api/qrcodeAPI';
import ScanPage from '@/pages/scan/[id]';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-head">{children}</div>
  ),
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
  it('shows a safe revoked or replaced state when the tag is inactive, not stale cached content', async () => {
    (qrcodeAPI.getOne as jest.Mock).mockResolvedValue({ ...activeTag, isActive: false });

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByText(/revoked or replaced by the owner/i)).toBeInTheDocument();
    });
    expect(petAPI.getPetEmergencyInfo).not.toHaveBeenCalled();
  });

  it('renders emergency info for an active tag', async () => {
    (qrcodeAPI.getOne as jest.Mock).mockResolvedValue(activeTag);

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByText(/Emergency Record/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/revoked or replaced by the owner/i)).not.toBeInTheDocument();
  });

  it('does not expose emergency details when an old replaced tag is no longer found', async () => {
    (qrcodeAPI.getOne as jest.Mock).mockRejectedValue(new Error('not found'));

    render(
      <ScanPage
        profile={{
          qrCodeId: 'old-tag',
          petId: 'pet-1',
          customMessage: 'Private medication note',
          emergencyContact: '555-1111',
          emergency: null,
        }}
        error={null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/No private pet details are available/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Private medication note/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/555-1111/i)).not.toBeInTheDocument();
    expect(petAPI.getPetEmergencyInfo).not.toHaveBeenCalled();
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
