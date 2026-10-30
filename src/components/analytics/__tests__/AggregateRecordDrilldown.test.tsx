import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PetHealthChart from '../PetHealthChart';

describe('PetHealthChart drill-down', () => {
  it('opens the authorized record list for a chart point', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        records: [{ id: 'r-1', title: 'Annual exam', date: '2024-05-12', petName: 'Luna' }],
      }),
    });

    const user = userEvent.setup();
    render(
      <PetHealthChart
        data={[{ name: 'Healthy', value: 4, color: '#1d4ed8' }]}
        fetchImpl={fetchMock}
        drilldownEndpoint="/api/analytics/pet-health-records"
      />,
    );

    await user.click(screen.getByRole('button', { name: /open authorized healthy records/i }));

    expect(await screen.findByRole('dialog', { name: /healthy records/i })).toBeInTheDocument();
    expect(screen.getByText('Annual exam')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/analytics/pet-health-records?status=Healthy'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('renders an empty state when the backend returns no authorized records', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ records: [] }),
    });

    const user = userEvent.setup();
    render(
      <PetHealthChart
        data={[{ name: 'Recovering', value: 0, color: '#1d4ed8' }]}
        fetchImpl={fetchMock}
        drilldownEndpoint="/api/analytics/pet-health-records"
      />,
    );

    await user.click(screen.getByRole('button', { name: /open authorized recovering records/i }));

    expect(await screen.findByText(/no authorized records are available/i)).toBeInTheDocument();
  });

  it('renders a denied state when authorization or consent is refused by the backend', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ denied: true, message: 'Record-level consent required.' }),
    });

    const user = userEvent.setup();
    render(
      <PetHealthChart
        data={[{ name: 'Critical', value: 2, color: '#b91c1c' }]}
        fetchImpl={fetchMock}
        drilldownEndpoint="/api/analytics/pet-health-records"
      />,
    );

    await user.click(screen.getByRole('button', { name: /open authorized critical records/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/record-level consent required/i);
  });

  it('surfaces a failure when the backend cannot return the drill-down records', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network failure'));

    const user = userEvent.setup();
    render(
      <PetHealthChart
        data={[{ name: 'Chronic condition', value: 3, color: '#92400e' }]}
        fetchImpl={fetchMock}
        drilldownEndpoint="/api/analytics/pet-health-records"
      />,
    );

    await user.click(screen.getByRole('button', { name: /open authorized chronic condition records/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to load authorized records/i);
  });
});
