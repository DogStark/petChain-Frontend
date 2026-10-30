import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

import { QrAccessHistory } from '../QrAccessHistory';
import { RawAccessEntry } from '@/utils/qrAccessHistory';

const entry = (over: Partial<RawAccessEntry> = {}): RawAccessEntry => ({
  timestamp: '2026-10-25T12:34:56.000Z',
  region: 'EU',
  scannerId: 'scanner-xyz',
  scannerName: 'Front Desk Kiosk',
  latitude: 12.34,
  longitude: 56.78,
  city: 'Berlin',
  ip: '203.0.113.9',
  ...over,
});

describe('QrAccessHistory', () => {
  it('renders the access history heading and summary', () => {
    render(<QrAccessHistory entries={[entry()]} />);
    expect(
      screen.getByRole('heading', { name: /who scanned your public profile/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/scan/i);
  });

  it('shows coarse bucket and region but never scanner identity or precise location', () => {
    render(<QrAccessHistory entries={[entry()]} />);
    expect(screen.getByText('2026-10-25 12:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('EU')).toBeInTheDocument();
    // identity + precise location must never render
    expect(screen.queryByText('scanner-xyz')).not.toBeInTheDocument();
    expect(screen.queryByText('Front Desk Kiosk')).not.toBeInTheDocument();
    expect(screen.queryByText('Berlin')).not.toBeInTheDocument();
    expect(screen.queryByText('203.0.113.9')).not.toBeInTheDocument();
    expect(screen.queryByText(/12\.34/)).not.toBeInTheDocument();
  });

  it('renders one row per scan, bucketed by hour', () => {
    render(
      <QrAccessHistory
        entries={[
          { timestamp: '2026-10-25T12:05:00.000Z', region: 'US' },
          { timestamp: '2026-10-25T12:59:00.000Z', region: 'US' },
          { timestamp: '2026-10-25T13:00:00.000Z', region: 'EU' },
        ]}
      />,
    );
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(screen.getAllByText('2026-10-25 12:00 UTC')).toHaveLength(2);
  });

  it('shows "region not recorded" when region is missing', () => {
    render(<QrAccessHistory entries={[{ timestamp: '2026-10-25T12:00:00.000Z', region: null }]} />);
    expect(screen.getByText(/region not recorded/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no scans', () => {
    render(<QrAccessHistory entries={[]} />);
    expect(screen.getByText(/no one has scanned your public profile yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows a denied state without listing any scans', () => {
    render(<QrAccessHistory entries={[entry()]} denied />);
    expect(screen.getByText(/turn on access history/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<QrAccessHistory entries={[entry()]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
