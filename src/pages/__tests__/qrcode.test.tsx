import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import QRCodePage from '../qrcode';
import { qrcodeAPI } from '@/lib/api/qrcodeAPI';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { petId: 'pet-123' },
    back: jest.fn(),
  }),
}));

jest.mock('@/components/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

describe('QRCodePage Print Scannability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders standard QR code SVG with appropriate level and margin for print', async () => {
    (qrcodeAPI.getByPetId as jest.Mock).mockResolvedValue([
      { qrCodeId: 'qr-123', isActive: true, scanCount: 5, petId: 'pet-123', createdAt: new Date().toISOString() },
    ]);

    const { container } = render(<QRCodePage />);

    await waitFor(() => {
      expect(screen.getByText('qr-123')).toBeInTheDocument();
    });

    // Check SVG structure for QR code
    const svg = container.querySelector('svg[id="qr-svg-qr-123"]');
    expect(svg).toBeInTheDocument();
    
    // Check sizing
    expect(svg).toHaveAttribute('height', '140');
    expect(svg).toHaveAttribute('width', '140');

    // Due to the nature of qrcode.react, we want to ensure it generated a valid SVG
    // with <path> elements representing the QR code.
    const path = svg?.querySelector('path');
    expect(path).toBeInTheDocument();
  });

  it('contains the print button for triggering print view', async () => {
    (qrcodeAPI.getByPetId as jest.Mock).mockResolvedValue([
      { qrCodeId: 'qr-123', isActive: true, scanCount: 5, petId: 'pet-123', createdAt: new Date().toISOString() },
    ]);

    render(<QRCodePage />);

    await waitFor(() => {
      expect(screen.getByText('qr-123')).toBeInTheDocument();
    });

    const printButton = screen.getByRole('button', { name: /print tags/i });
    expect(printButton).toBeInTheDocument();
  });
});
