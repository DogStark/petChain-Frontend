import { act, renderHook } from '@testing-library/react';

import { useAnalyticsExportPreview } from '@/hooks/useAnalyticsExportPreview';
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

describe('useAnalyticsExportPreview', () => {
  beforeEach(() => {
    requestMock.mockReset();
    localStorage.clear();
  });

  it('starts masked and never contacts the backend on its own', () => {
    const { result } = renderHook(() => useAnalyticsExportPreview(sampleData));

    expect(result.current.status).toBe('masked');
    expect(result.current.personalDataIncluded).toBe(false);
    expect(result.current.message).toBeNull();
    expect(result.current.canDownload).toBe(true);
    expect(requestMock).not.toHaveBeenCalled();

    const csv = result.current.analyticsExport?.csv ?? '';
    expect(csv).toContain('Nor•••');
    expect(csv).not.toContain('North America');
  });

  it('requests the exact date range shown in the preview and unmasks on approval', async () => {
    requestMock.mockResolvedValue({ allowed: true, message: 'Authorised for this account.' });
    const { result } = renderHook(() => useAnalyticsExportPreview(sampleData));

    await act(async () => {
      await result.current.requestPersonalData();
    });

    expect(requestMock).toHaveBeenCalledWith({
      startDate: '2026-10-25',
      endDate: '2026-10-26',
    });
    expect(result.current.status).toBe('granted');
    expect(result.current.personalDataIncluded).toBe(true);
    expect(result.current.message).toBe('Authorised for this account.');
    expect(result.current.analyticsExport?.csv).toContain('North America');
  });

  it('stays masked when the backend declines personal data', async () => {
    requestMock.mockResolvedValue({
      allowed: false,
      message: 'Consent is missing for this account.',
    });
    const { result } = renderHook(() => useAnalyticsExportPreview(sampleData));

    await act(async () => {
      await result.current.requestPersonalData();
    });

    expect(result.current.status).toBe('denied');
    expect(result.current.personalDataIncluded).toBe(false);
    expect(result.current.message).toBe('Consent is missing for this account.');
    expect(result.current.analyticsExport?.csv).not.toContain('North America');
  });

  it('treats a 403 from the access endpoint as a denial, not a crash', async () => {
    requestMock.mockRejectedValue(
      new PersonalDataAccessError('Personal data is not authorised', 403, 'consent_not_granted'),
    );
    const { result } = renderHook(() => useAnalyticsExportPreview(sampleData));

    await act(async () => {
      await result.current.requestPersonalData();
    });

    expect(result.current.status).toBe('denied');
    expect(result.current.message).toBe('Personal data is not authorised');
    expect(result.current.personalDataIncluded).toBe(false);
    expect(result.current.requesting).toBe(false);
  });

  it('keeps the export masked when the access check fails', async () => {
    requestMock.mockRejectedValue(new PersonalDataAccessError('Could not reach the server'));
    const { result } = renderHook(() => useAnalyticsExportPreview(sampleData));

    await act(async () => {
      await result.current.requestPersonalData();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.personalDataIncluded).toBe(false);
    expect(result.current.message).toContain('Could not reach the server');
    expect(result.current.analyticsExport?.csv).not.toContain('North America');
  });

  it('falls back to a generic message for unexpected failures', async () => {
    requestMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAnalyticsExportPreview(sampleData));

    await act(async () => {
      await result.current.requestPersonalData();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.personalDataIncluded).toBe(false);
    expect(result.current.message).toBe(
      'Could not verify personal-data access, so identifiers stay masked. Try again.',
    );
  });

  it('returns to the masked state when the user opts back out', async () => {
    requestMock.mockResolvedValue({ allowed: true });
    const { result } = renderHook(() => useAnalyticsExportPreview(sampleData));

    await act(async () => {
      await result.current.requestPersonalData();
    });
    expect(result.current.personalDataIncluded).toBe(true);

    act(() => {
      result.current.excludePersonalData();
    });

    expect(result.current.personalDataIncluded).toBe(false);
    expect(result.current.status).toBe('masked');
    expect(result.current.message).toBeNull();
    expect(result.current.analyticsExport?.csv).not.toContain('North America');
  });

  it('ignores an approval that arrives after the user opted out', async () => {
    let resolveRequest: (value: { allowed: boolean }) => void = () => undefined;
    requestMock.mockReturnValue(
      new Promise<{ allowed: boolean }>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { result } = renderHook(() => useAnalyticsExportPreview(sampleData));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.requestPersonalData();
    });
    act(() => {
      result.current.excludePersonalData();
    });
    await act(async () => {
      resolveRequest({ allowed: true });
      await pending;
    });

    expect(result.current.personalDataIncluded).toBe(false);
    expect(result.current.status).toBe('masked');
    expect(result.current.requesting).toBe(false);
  });

  it('reports an empty export and disables downloading', () => {
    const { result } = renderHook(() => useAnalyticsExportPreview(emptyData));

    expect(result.current.analyticsExport?.dataRowCount).toBe(0);
    expect(result.current.analyticsExport?.dateRange).toBeNull();
    expect(result.current.canDownload).toBe(false);
  });

  it('handles a missing data payload', () => {
    const { result } = renderHook(() => useAnalyticsExportPreview(null));

    expect(result.current.analyticsExport).toBeNull();
    expect(result.current.canDownload).toBe(false);
    expect(result.current.personalDataIncluded).toBe(false);
  });

  it('asks the backend for access only when there is a range to scope to', async () => {
    requestMock.mockResolvedValue({ allowed: false });
    const { result } = renderHook(() => useAnalyticsExportPreview(emptyData));

    await act(async () => {
      await result.current.requestPersonalData();
    });

    expect(requestMock).toHaveBeenCalledWith({});
    expect(result.current.status).toBe('denied');
  });
});
