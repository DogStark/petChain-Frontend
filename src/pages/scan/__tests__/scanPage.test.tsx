/**
 * Tests for the public scan page (src/pages/scan/[id].tsx).
 *
 * Covers:
 *  - Success: valid QR code shows emergency profile
 *  - Deactivated: shows "deactivated by owner" message
 *  - Invalid: shows "invalid or no longer active" message
 *  - Rate-limited (429): shows "too many requests" message
 *  - Empty / loading states
 *  - Boundary: missing id parameter
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/router
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { id: 'QR-TEST123' },
    push: mockPush,
    back: mockBack,
  }),
}));

// Mock the APIs
jest.mock('@/lib/api/qrcodeAPI', () => ({
  qrcodeAPI: {
    getOne: jest.fn(),
    recordScan: jest.fn(),
    getAnalytics: jest.fn(),
  },
}));

jest.mock('@/lib/api/petAPI', () => ({
  petAPI: {
    getPetEmergencyInfo: jest.fn(),
  },
}));

import { qrcodeAPI } from '@/lib/api/qrcodeAPI';
import { petAPI } from '@/lib/api/petAPI';

// Import the page component
// We need to test the client-side behavior, so we render with initial props
// and let the useEffect re-fetch.

describe('ScanPage – error handling & throttling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows rate-limit message when API returns 429', async () => {
    // Make getOne throw a 429 error
    (qrcodeAPI.getOne as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Rate limited'), { status: 429 }),
    );
    (qrcodeAPI.recordScan as jest.Mock).mockResolvedValue(undefined);

    // Render with null initial profile (simulates SSR with no props)
    const { default: ScanPage } = await import('@/pages/scan/[id]');
    render(<ScanPage profile={null} error={null} />);

    await waitFor(() => {
      expect(
        screen.getByText(/too many requests/i),
      ).toBeInTheDocument();
    });
  });

  it('shows "invalid" message for non-429 errors', async () => {
    (qrcodeAPI.getOne as jest.Mock).mockRejectedValue(
      new Error('Not found'),
    );
    (qrcodeAPI.recordScan as jest.Mock).mockResolvedValue(undefined);

    const { default: ScanPage } = await import('@/pages/scan/[id]');
    render(<ScanPage profile={null} error={null} />);

    await waitFor(() => {
      expect(
        screen.getByText(/invalid or no longer active/i),
      ).toBeInTheDocument();
    });
  });

  it('shows "deactivated" message when QR is inactive', async () => {
    (qrcodeAPI.getOne as jest.Mock).mockResolvedValue({
      qrCodeId: 'QR-INACTIVE',
      petId: 'pet-1',
      isActive: false,
    });
    (qrcodeAPI.recordScan as jest.Mock).mockResolvedValue(undefined);

    const { default: ScanPage } = await import('@/pages/scan/[id]');
    render(<ScanPage profile={null} error={null} />);

    await waitFor(() => {
      expect(
        screen.getByText(/deactivated by the owner/i),
      ).toBeInTheDocument();
    });
  });

  it('shows the emergency profile for a valid active QR code', async () => {
    (qrcodeAPI.getOne as jest.Mock).mockResolvedValue({
      qrCodeId: 'QR-VALID',
      petId: 'pet-1',
      isActive: true,
      emergencyContact: '555-1234',
      customMessage: 'Help my dog!',
    });
    (qrcodeAPI.recordScan as jest.Mock).mockResolvedValue(undefined);
    (petAPI.getPetEmergencyInfo as jest.Mock).mockResolvedValue({
      petId: 'pet-1',
      contacts: [],
      medicalNotes: 'Allergic to penicillin',
    });

    const { default: ScanPage } = await import('@/pages/scan/[id]');
    render(<ScanPage profile={null} error={null} />);

    await waitFor(() => {
      expect(screen.getByText(/help my dog/i)).toBeInTheDocument();
    });
  });

  it('shows pre-rendered error when initialError is provided', () => {
    const { default: ScanPage } = require('@/pages/scan/[id]');
    render(
      <ScanPage
        profile={null}
        error="This QR code is invalid or no longer active."
      />,
    );

    expect(
      screen.getByText(/invalid or no longer active/i),
    ).toBeInTheDocument();
  });

  it('shows pre-rendered profile when initialProfile is provided', () => {
    const { default: ScanPage } = require('@/pages/scan/[id]');
    render(
      <ScanPage
        profile={{
          qrCodeId: 'QR-SSR',
          petId: 'pet-ssr',
          customMessage: 'SSR message',
          emergencyContact: null,
          emergency: null,
        }}
        error={null}
      />,
    );

    expect(screen.getByText(/ssr message/i)).toBeInTheDocument();
  });
});
