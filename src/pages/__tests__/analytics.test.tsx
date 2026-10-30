import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AnalyticsPage from '../analytics';
import { generateAnalyticsData } from '@/lib/analyticsUserData';
import { DataModeProvider } from '@/contexts/DataModeContext';

jest.mock('next/dynamic', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: () => () => ReactModule.createElement('div'),
  };
});

jest.mock('@/lib/analyticsUserData', () => ({
  generateAnalyticsData: jest.fn(),
}));

const generateAnalyticsDataMock = generateAnalyticsData as jest.MockedFunction<typeof generateAnalyticsData>;
const sampleData: Awaited<ReturnType<typeof generateAnalyticsData>> = {
  engagementData: [{ date: 'Mon', activeUsers: 120, newSignups: 12 }],
  healthData: [
    { name: 'Healthy', value: 8, color: '#10B981' },
    { name: 'Critical', value: 2, color: '#EF4444' },
  ],
  vaccinationData: [{ month: 'Jan', compliant: 85, nonCompliant: 15 }],
  geoData: [{ region: 'North America', users: 42 }],
  apiUsageData: [{ time: '9:00', requests: 100, errors: 3 }],
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('AnalyticsPage accessibility', () => {
  /** The page renders inside providers that _app supplies in production. */
  const renderPage = () =>
    render(
      <DataModeProvider>
        <AnalyticsPage />
      </DataModeProvider>,
    );

  beforeEach(() => {
    generateAnalyticsDataMock.mockResolvedValue(sampleData);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('exposes the chart values and semantic health/vaccination labels in keyboard-accessible tables', async () => {
    const user = userEvent.setup();
    renderPage();

    const engagementSection = await screen.findByRole('region', { name: 'User engagement analytics' });
    const engagementSummary = within(engagementSection).getByText('View data table: User engagement');
    engagementSummary.focus();
    await user.keyboard(' ');
    const engagementTable = within(engagementSection).getByRole('table', { name: 'User engagement' });
    expect(within(engagementTable).getByRole('row', { name: 'Mon 120 12' })).toBeInTheDocument();

    const healthSection = screen.getByRole('region', { name: 'Pet health analytics' });
    fireEvent.click(within(healthSection).getByText('View data table: Pet health distribution'));
    const healthTable = within(healthSection).getByRole('table', { name: 'Pet health distribution' });
    expect(within(healthTable).getByRole('row', { name: 'Healthy 8 80%' })).toBeInTheDocument();
    expect(within(healthTable).getByRole('row', { name: 'Critical 2 20%' })).toBeInTheDocument();

    const vaccinationSection = screen.getByRole('region', { name: 'Vaccination analytics' });
    fireEvent.click(within(vaccinationSection).getByText('View data table: Vaccination compliance'));
    expect(within(vaccinationSection).getByRole('table', { name: 'Vaccination compliance' })).toHaveTextContent('Non-compliant (%)');

    const geographicSection = screen.getByRole('region', { name: 'Geographic analytics' });
    fireEvent.click(within(geographicSection).getByText('View data table: Geographic distribution'));
    expect(within(geographicSection).getByRole('table', { name: 'Geographic distribution' })).toHaveTextContent('North America');

    const apiSection = screen.getByRole('region', { name: 'API usage analytics' });
    fireEvent.click(within(apiSection).getByText('View data table: API usage'));
    expect(within(apiSection).getByRole('table', { name: 'API usage' })).toHaveTextContent('100');
  });

  it('discloses empty data and reports load failure with a retry action', async () => {
    const user = userEvent.setup();
    const emptyData = {
      ...sampleData,
      engagementData: [],
      healthData: [],
      vaccinationData: [],
      geoData: [],
      apiUsageData: [],
    };
    generateAnalyticsDataMock.mockResolvedValueOnce(emptyData);
    const { unmount } = renderPage();

    const engagementSection = await screen.findByRole('region', { name: 'User engagement analytics' });
    fireEvent.click(within(engagementSection).getByText('View data table: User engagement'));
    expect(within(engagementSection).getByRole('table', { name: 'User engagement' })).toHaveTextContent(
      'No chart data available.',
    );
    unmount();

    generateAnalyticsDataMock.mockRejectedValueOnce(new Error('network unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Analytics data could not be loaded.');
    generateAnalyticsDataMock.mockResolvedValueOnce(sampleData);
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('View data table: User engagement')).toBeInTheDocument();
  });

  it('opens a privacy-aware export preview instead of downloading immediately', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('View data table: User engagement');
    await user.click(screen.getByRole('button', { name: /Export Report/i }));

    expect(await screen.findByRole('dialog', { name: /Export preview/i })).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: /Export preview/i });
    expect(screen.getByTestId('export-date-range')).toHaveTextContent(
      '2026-01-01 to 2026-01-01 (1 day)',
    );

    // Privacy by default: personal data stays masked until explicitly requested.
    expect(screen.getByRole('checkbox', { name: /include personal data/i })).not.toBeChecked();
    expect(within(dialog).getByText('Nor•••')).toBeInTheDocument();
    expect(within(dialog).queryByText('North America')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Download CSV/i })).toBeEnabled();
  });
});
