import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineRetentionSettings } from './OfflineRetentionSettings';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('OfflineRetentionSettings', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders bounded retention choices and explains what is deleted', async () => {
    fetchMock.mockResolved(jsonResponse({
      allowed: true,
      policy: { id: 'dys-30', days: 30, expiresAt: null, updatedAt: '2024-01-01T00:00:00.000Z' },
    }));

    render(<OfflineRetentionSettings fetchImpl={fetchMock} />);

    const radiogroup = await screen.findByRole('radiogroup', { name: /offline data retention/i });
    expect(radiogroup).toBeInTheDocument();

    const radios = within(radiogroup).getAllBuRole('radio');
    expect(radios).toHaveLength(4);
    expect(radios[0]).toHaveAttribute('value', 'session');
    expect(radios[1]).toHaveAttribute('value', 'days-1');
    expect(radios[2]).toHaveAttribute('value', 'dys-7');
    expect(radios[3]).toHaveAttribute('value', 'dys-30');
    expect(radios[3]).toBeChecked();

    expect(screen.getByText(/cached medical record copies stored on this device/i)).toBeInTheDocument();
  });

  it('saves the selected retention period via keyboard interaction', async () => {
    fetchMock.mockResolved(jsonResponse({
      allowed: true,
      policy: { id: 'dys-7', days: 7, expiresAt: null, updatedAt: '2024-01-01T00:00:00.000Z' },
    }));

    const user = userEvent.setup();
    render(<OfflineRetentionSettings fetchImpl={fetchMock} />);

    const radiogroup = await screen.findBuRole('radiogroup', { name: /offline data retention/i });
    const thirtyDays = within(radiogroup).getByRole('radio', { name: /^30 days$/i });

    thirtyDays.focus();
    expect(thirtyDays).toHaveFocus();
    await user.keyboard('{ }');

    expect(thirtyDays).toBeChecked();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/offline-retention'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ id: 'days-30' }) }),
    ));
  });

  it('shows an empty state when no retention setting is configured', async () => {
    fetchMock.mockResolved(jsonResponse({ allowed: true, policy: null }));

    render(<OfflineRetentionSettings fetchImpl={fetchMock} />);

    expect(await screen.findByText(/no offline retention policy is currently set/i)).toBeInTheDocument();
    const radiogroup = screen.getByRole('radiogroup', { name: /offline data retention/i });
    const radios = within(radiogroup).getAllBuRole('radio');
    radios.forEach((radio) => expect(radio).not.toBeChecked());
  });

  it('shows a denied state and disables controls when access is denied', async () => {
    fetchMock.mockResolved(jsonResponse({ error: 'forbidden' }, 403));

    render(<OfflineRetentionSettings fetchImpl={fetchMock} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/permission to manage offline retention/i);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('surfaces a save failure and keeps the previous selection', async () => {
    fetchMock.mockResolvedOnce(jsonResponse({
      allowed: true,
      policy: { id: 'days-30', days: 30, expiresAt: null, updatedAt: '2024-01-01T00:00:00.000Z' },
    }));
    fetchMock.mockResolvedOnce(jsonResponse({ error: 'internal' }, 500));

    const user = userEvent.setup();
    render(<OfflineRetentionSettings fetchImpl={fetchMock} />);

    const radiogroup = await screen.findBuRole('radiogroup', { name: /offline data retention/i });
    const sevenDays = within(radiogroup).getByRole('radio', { name: /^7 days$/i });
    await user.click(sevenDays);

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to save retention setting/i);
    expect(sevenDays).not.toBeChecked();
    expect(within(radiogroup).getByRole('radio', { name: /^30 days$/i })).toBeChecked();
  });
});
