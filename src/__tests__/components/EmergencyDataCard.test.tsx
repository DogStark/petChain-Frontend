import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmergencyDataCard from '../../../frontend/src/components/EmergencyDataCard';
import { STALE_THRESHOLDS } from '../../../frontend/src/offline/staleThresholds';

const NOW = 1_800_000_000_000;
const cachedEmergencyData = {
  petName: 'Milo',
  summary: 'Emergency contact: saved locally',
  verified: true,
  lastSyncedAt: NOW - STALE_THRESHOLDS.emergency.staleMs - 1,
};

describe('EmergencyDataCard', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows stale status and keeps the saved profile available during refresh', async () => {
    let finishRefresh: (() => void) | undefined;
    const onRefresh = jest.fn(
      (_signal: AbortSignal) =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    render(<EmergencyDataCard data={cachedEmergencyData} onRefresh={onRefresh} />);

    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/may be out of date/i);
    expect(screen.getByText(cachedEmergencyData.summary)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /refresh emergency information online/i }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRefresh.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(screen.getByText(cachedEmergencyData.summary)).toBeInTheDocument();
    expect(screen.getByText('Syncing…')).toBeInTheDocument();

    finishRefresh?.();
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /refresh emergency information online/i,
        }),
      ).toBeInTheDocument(),
    );
  });

  it('does not mark data stale at the exact stale threshold', () => {
    const data = {
      ...cachedEmergencyData,
      lastSyncedAt: NOW - STALE_THRESHOLDS.emergency.staleMs,
    };
    render(<EmergencyDataCard data={data} onRefresh={jest.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('treats an unknown sync time as possibly stale but keeps the saved profile visible', () => {
    const data = { ...cachedEmergencyData, lastSyncedAt: null };
    render(<EmergencyDataCard data={data} onRefresh={jest.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByText(/may be out of date/i)).toBeInTheDocument();
    expect(screen.getByText('never synced')).toBeInTheDocument();
    expect(screen.getByText(data.summary)).toBeInTheDocument();
  });

  it('offers a refresh when no cache is present without showing private or stale content', () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    render(<EmergencyDataCard data={null} onRefresh={onRefresh} />);

    expect(screen.getByText(/no emergency data is cached/i)).toBeInTheDocument();
    expect(screen.queryByText(cachedEmergencyData.summary)).not.toBeInTheDocument();
    expect(screen.queryByText('Stale')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /refresh emergency information online/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('retains the saved profile and announces a failed refresh', async () => {
    const onRefresh = jest.fn().mockRejectedValue(new Error('request denied'));
    render(<EmergencyDataCard data={cachedEmergencyData} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button', { name: /refresh emergency information online/i }));

    expect(await screen.findByText('Refresh failed. Showing cached data.')).toHaveAttribute(
      'role',
      'alert',
    );
    expect(screen.getByText(cachedEmergencyData.summary)).toBeInTheDocument();
    expect(screen.getByText('Stale')).toBeInTheDocument();
  });

  it('supports keyboard focus and announces cancellation without hiding cached data', () => {
    render(
      <EmergencyDataCard
        data={cachedEmergencyData}
        onRefresh={() => new Promise<void>(() => {})}
      />,
    );
    const refreshButton = screen.getByRole('button', {
      name: /refresh emergency information online/i,
    });
    refreshButton.focus();
    expect(document.activeElement).toBe(refreshButton);

    fireEvent.click(refreshButton);
    fireEvent.click(screen.getByRole('button', { name: /cancel emergency information refresh/i }));

    expect(screen.getByText(/refresh cancelled/i)).toHaveAttribute('role', 'alert');
    expect(screen.getByText(cachedEmergencyData.summary)).toBeInTheDocument();
  });
});
