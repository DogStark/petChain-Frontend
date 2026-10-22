import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScheduledReportsPanel from '../ScheduledReportsPanel';
import { reportSchedulesAPI } from '@/lib/api/reportSchedulesAPI';

jest.mock('@/lib/api/reportSchedulesAPI', () => ({
  reportSchedulesAPI: {
    list: jest.fn(),
    create: jest.fn(),
  },
}));

const mockedAPI = jest.mocked(reportSchedulesAPI);

describe('ScheduledReportsPanel', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedAPI.list.mockResolvedValue([]);
  });

  it('creates a private schedule with its timezone, recipient scope, and expiry', async () => {
    const user = userEvent.setup();
    mockedAPI.create.mockResolvedValue({
      id: 'schedule-1',
      reportType: 'health',
      frequency: 'weekly',
      startsAt: '2027-01-01T09:00:00',
      timezone: 'America/Los_Angeles',
      recipientScope: 'requesting_admin',
      expiresAt: '2027-02-01T09:00:00',
      createdAt: '2026-12-01T12:00:00Z',
    });
    render(<ScheduledReportsPanel />);
    await screen.findByText('No reports are scheduled.');

    await user.selectOptions(screen.getByLabelText('Report'), 'health');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'weekly');
    await user.clear(screen.getByLabelText('First delivery'));
    await user.type(screen.getByLabelText('First delivery'), '2027-01-01T09:00');
    await user.clear(screen.getByLabelText('Timezone (IANA)'));
    await user.type(screen.getByLabelText('Timezone (IANA)'), 'America/Los_Angeles');
    await user.clear(screen.getByLabelText('Schedule expires'));
    await user.type(screen.getByLabelText('Schedule expires'), '2027-02-01T09:00');
    await user.click(screen.getByRole('button', { name: 'Schedule report' }));

    await screen.findByRole('status', { name: /report schedule created/i });
    expect(mockedAPI.create).toHaveBeenCalledWith({
      reportType: 'health',
      frequency: 'weekly',
      startsAt: '2027-01-01T09:00',
      timezone: 'America/Los_Angeles',
      recipientScope: 'requesting_admin',
      expiresAt: '2027-02-01T09:00',
    });
  });

  it('shows an empty state and defaults delivery to the requesting administrator', async () => {
    render(<ScheduledReportsPanel />);

    expect(await screen.findByText('No reports are scheduled.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /only me/i })).toBeChecked();
    expect(screen.getByText(/never published as public links/i)).toBeInTheDocument();
  });

  it('shows an authorization denial from the scheduling service', async () => {
    mockedAPI.list.mockRejectedValue({ response: { status: 403 } });
    render(<ScheduledReportsPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/not authorized/i);
    expect(screen.queryByRole('button', { name: /schedule report/i })).not.toBeInTheDocument();
  });

  it('rejects expiry at or before the first delivery without sending a request', async () => {
    const user = userEvent.setup();
    render(<ScheduledReportsPanel />);
    await screen.findByText('No reports are scheduled.');

    await user.clear(screen.getByLabelText('First delivery'));
    await user.type(screen.getByLabelText('First delivery'), '2027-01-01T09:00');
    await user.clear(screen.getByLabelText('Schedule expires'));
    await user.type(screen.getByLabelText('Schedule expires'), '2027-01-01T09:00');
    await user.click(screen.getByRole('button', { name: 'Schedule report' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/expiry must be later/i);
    expect(mockedAPI.create).not.toHaveBeenCalled();
  });

  it('announces a delivery failure and keeps the form available', async () => {
    const user = userEvent.setup();
    mockedAPI.create.mockRejectedValue(new Error('Service unavailable'));
    render(<ScheduledReportsPanel />);
    await screen.findByText('No reports are scheduled.');

    await user.click(screen.getByRole('button', { name: 'Schedule report' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    expect(screen.getByRole('button', { name: 'Schedule report' })).toBeEnabled();
  });

  it('allows choosing a team recipient with the keyboard', async () => {
    const user = userEvent.setup();
    render(<ScheduledReportsPanel />);
    await screen.findByText('No reports are scheduled.');

    const teamOption = screen.getByRole('radio', { name: /authorized administrators/i });
    teamOption.focus();
    await user.keyboard('{Space}');

    expect(teamOption).toBeChecked();
  });
});
