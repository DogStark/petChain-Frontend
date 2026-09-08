import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { qrcodeAPI, type QRCodeRecord } from '@/lib/api/qrcodeAPI';
import QRCodePage from '@/pages/qrcode';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-head">{children}</div>
  ),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { petId: '11111111-1111-4111-8111-111111111111' },
    back: jest.fn(),
  }),
}));

jest.mock('@/components/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock('@/lib/api/qrcodeAPI', () => ({
  qrcodeAPI: {
    getByPetId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    regenerate: jest.fn(),
    getAnalytics: jest.fn(),
  },
}));

jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ id, value }: { id: string; value: string }) => (
    <svg id={id} data-testid={id} aria-label={`QR code for ${value}`} />
  ),
}));

const oldTag: QRCodeRecord = {
  id: 'record-1',
  petId: '11111111-1111-4111-8111-111111111111',
  qrCodeId: 'QR-old',
  isActive: true,
  scanCount: 8,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const replacementTag: QRCodeRecord = {
  ...oldTag,
  qrCodeId: 'QR-new',
  isActive: true,
  scanCount: 0,
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('QRCodePage tag rotation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    (qrcodeAPI.getByPetId as jest.Mock).mockResolvedValue([oldTag]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replaces a revoked old tag with the new active tag after rotation', async () => {
    (qrcodeAPI.regenerate as jest.Mock).mockResolvedValue(replacementTag);

    render(<QRCodePage />);

    expect(await screen.findByText('QR-old')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /replace tag/i }));

    await waitFor(() => {
      expect(screen.getByText('QR-new')).toBeInTheDocument();
    });

    expect(screen.queryByText('QR-old')).not.toBeInTheDocument();
    expect(
      screen.getByText(/replacement tag QR-new is active/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/old tag QR-old is no longer valid/i)).toBeInTheDocument();
  });
});

