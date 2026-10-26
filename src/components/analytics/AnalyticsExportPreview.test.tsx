import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import React from 'react';

import AnalyticsExportPreview from '@/components/analytics/AnalyticsExportPreview';
import type { AnalyticsExportData } from '@/lib/analytics/exportBuilder';
import { exportAccessAPI, PersonalDataAccessError } from '@/lib/api/exportAccessAPI';

jest.mock('@/lib/api/exportAccessAPI', () => {
  const actual = jest.requireActual('@/lib/api/exportAccessAPI');
  return {
    ...actual,
    exportAccessAPI: { requestPersonalDataAccess: jest.fn() },
  };
});

const requestMock = exportAccessAPI.requestPersonalDataAccess as jest.MockedFunction<
  typeof exportAccessAPI.requestPersonalDataAccess
>;

const sampleData: AnalyticsExportData = {
  engagementData: [
    { date: 'Mon', activeUsers: 120, newSignups: 12 },
    { date: 'Tue', activeUsers: 135, newSignups: 18 },
    { date: 'Wed', activeUsers: 145, newSignups: 22 },
  ],
  healthData: [{ name: 'Healthy', value: 8 }],
  vaccinationData: [{ month: 'Jan', compliant: 85, nonCompliant: 15 }],
  geoData: [{ region: 'North America', users: 42 }],
  apiUsageData: [{ time: '9:00', requests: 100, errors: 3 }],
  timestamp: '2026-10-26T12:00:00.000Z',
};

const emptyData: AnalyticsExportData = {
  ...sampleData,
  engagementData: [],
  healthData: [],
  vaccinationData: [],
  geoData: [],
  apiUsageData: [],
};

describe('AnalyticsExportPreview', () => {
  const onClose = jest.fn();
  const onDownload = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    requestMock.mockReset();
    localStorage.clear();
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 'usr_8f2a9b31', email: 'jane@example.com' }),
    );
  });

  it('shows the exact fields, date range and masked identifiers, then downloads only after approval', async () => {
    const user = userEvent.setup();
    requestMock.mockResolvedValue({ allowed: true });

    render(
      <AnalyticsExportPreview isOpen onClose={onClose} data={sampleData} onDownload={onDownload} />,
    );

    const dialog = await screen.findByRole('dialog', { name: /export preview/i });

    // Exact date range included in the export.
    expect(screen.getByTestId('export-date-range')).toHaveTextContent(
      '2026-10-24 to 2026-10-26 (3 days)',
    );

    // Exact field manifest, including which fields carry personal data.
    const fieldsTable = within(dialog).getByRole('table', {
      name: /exact fields included in this export/i,
    });
    expect(within(fieldsTable).getByText('account_email')).toBeInTheDocument();
    expect(within(fieldsTable).getByText('region')).toBeInTheDocument();
    expect(within(fieldsTable).getAllByText(/Yes — masked unless authorised/).length).toBe(3);
    expect(within(fieldsTable).getAllByText('No').length).toBeGreaterThan(0);

    // Identifiers are masked by default and personal data is opt-in.
    expect(screen.getByText('Nor•••')).toBeInTheDocument();
    expect(screen.getByText('j•••@e•••.com')).toBeInTheDocument();
    expect(screen.queryByText('North America')).not.toBeInTheDocument();
    expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox', {
      name: /include personal data/i,
    });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: /download csv/i })).toBeEnabled();

    // Separate action: requesting personal data asks the backend.
    await user.click(checkbox);
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(1));
    expect(requestMock).toHaveBeenCalledWith({
      startDate: '2026-10-24',
      endDate: '2026-10-26',
    });

    expect(await screen.findByText(/authorised by the server/i)).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(screen.getByText('North America')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /download csv \(personal data included\)/i }));

    expect(onDownload).toHaveBeenCalledTimes(1);
    const downloaded = onDownload.mock.calls[0][0] as { personalDataIncluded: boolean; csv: string };
    expect(downloaded.personalDataIncluded).toBe(true);
    expect(downloaded.csv).toContain('North America');
  });

  it('keeps identifiers masked and reverts the opt-in when the backend denies access', async () => {
    const user = userEvent.setup();
    requestMock.mockRejectedValue(
      new PersonalDataAccessError('Consent is missing for this account', 403, 'consent_not_granted'),
    );

    render(
      <AnalyticsExportPreview isOpen onClose={onClose} data={sampleData} onDownload={onDownload} />,
    );

    const checkbox = screen.getByRole('checkbox', { name: /include personal data/i });
    await user.click(checkbox);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Consent is missing for this account',
    );
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByText('North America')).not.toBeInTheDocument();
    expect(screen.getByText('Nor•••')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^download csv$/i }));
    const downloaded = onDownload.mock.calls[0][0] as {
      personalDataIncluded: boolean;
      csv: string;
    };
    expect(downloaded.personalDataIncluded).toBe(false);
    expect(downloaded.csv).not.toContain('North America');
  });

  it('reports a failed access check as an error without unmasking', async () => {
    const user = userEvent.setup();
    requestMock.mockRejectedValue(new PersonalDataAccessError('Could not reach the server'));

    render(<AnalyticsExportPreview isOpen onClose={onClose} data={sampleData} />);

    await user.click(screen.getByRole('checkbox', { name: /include personal data/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Could not reach the server');
    expect(screen.queryByText('North America')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /include personal data/i })).not.toBeChecked();
  });

  it('discloses an empty date range and blocks downloading', () => {
    render(
      <AnalyticsExportPreview isOpen onClose={onClose} data={emptyData} onDownload={onDownload} />,
    );

    expect(screen.getByTestId('export-date-range')).toHaveTextContent(
      'Unavailable — this export has no dated rows.',
    );
    expect(screen.getByTestId('export-preview-no-rows')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download csv/i })).toBeDisabled();
    expect(onDownload).not.toHaveBeenCalled();
  });

  it('reports a missing data payload as an empty preview', () => {
    render(<AnalyticsExportPreview isOpen onClose={onClose} data={null} onDownload={onDownload} />);

    expect(screen.getByTestId('export-preview-empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download csv/i })).not.toBeInTheDocument();
  });

  it('supports keyboard dismissal and keeps focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(
      <AnalyticsExportPreview isOpen onClose={onClose} data={sampleData} onDownload={onDownload} />,
    );

    const dialog = await screen.findByRole('dialog', { name: /export preview/i });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no detectable axe violations', async () => {
    const { container } = render(
      <AnalyticsExportPreview isOpen onClose={onClose} data={sampleData} onDownload={onDownload} />,
    );

    await screen.findByRole('dialog', { name: /export preview/i });
    expect(await axe(container)).toHaveNoViolations();
  });
});
