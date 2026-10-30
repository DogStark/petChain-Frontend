import type {
  AnalyticsExportData} from '@/lib/analytics/exportBuilder';
import {
  buildAnalyticsExport,
  downloadAnalyticsExport,
  resolveExportDateRange,
} from '@/lib/analytics/exportBuilder';

const baseData: AnalyticsExportData = {
  engagementData: [
    { date: 'Mon', activeUsers: 120, newSignups: 12 },
    { date: 'Tue', activeUsers: 135, newSignups: 18 },
    { date: 'Wed', activeUsers: 145, newSignups: 22 },
  ],
  healthData: [
    { name: 'Healthy', value: 8, color: '#10B981' },
    { name: 'Chronic, condition', value: 2, color: '#EF4444' },
  ],
  vaccinationData: [{ month: 'Jan', compliant: 85, nonCompliant: 15 }],
  geoData: [
    { region: 'North America', users: 42 },
    { region: 'Lagos', users: 12 },
  ],
  apiUsageData: [{ time: '9:00', requests: 100, errors: 3 }],
  timestamp: '2026-10-26T12:00:00.000Z',
};

const account = { id: 'usr_8f2a9b31', email: 'jane@example.com' };

function allFields(analyticsExport: ReturnType<typeof buildAnalyticsExport>) {
  return analyticsExport.sections.flatMap((section) => section.fields);
}

describe('buildAnalyticsExport', () => {
  it('describes the exact fields and date range covered by the export', () => {
    const analyticsExport = buildAnalyticsExport(baseData, { account });

    expect(analyticsExport.dateRange).toEqual({
      startDate: '2026-10-24',
      endDate: '2026-10-26',
      days: 3,
    });
    expect(analyticsExport.generatedAt).toBe('2026-10-26T12:00:00.000Z');

    const keys = allFields(analyticsExport).map((field) => field.key);
    expect(keys).toEqual([
      'generated_at',
      'range_start',
      'range_end',
      'account_id',
      'account_email',
      'date',
      'activeUsers',
      'newSignups',
      'name',
      'value',
      'month',
      'compliant',
      'nonCompliant',
      'region',
      'users',
      'time',
      'requests',
      'errors',
    ]);

    const personal = allFields(analyticsExport).filter((field) => field.containsPersonalData);
    expect(personal.map((field) => field.key)).toEqual(['account_id', 'account_email', 'region']);
    expect(analyticsExport.dataRowCount).toBe(9);
  });

  it('masks identifiers by default and keeps them out of the CSV', () => {
    const analyticsExport = buildAnalyticsExport(baseData, { account });

    expect(analyticsExport.personalDataIncluded).toBe(false);

    const metadata = analyticsExport.sections.find((section) => section.id === 'metadata');
    expect(metadata?.rows[0]).toEqual({
      generated_at: '2026-10-26T12:00:00.000Z',
      range_start: '2026-10-24',
      range_end: '2026-10-26',
      account_id: 'usr_••••9b31',
      account_email: 'j•••@e•••.com',
    });

    const geo = analyticsExport.sections.find((section) => section.id === 'geographic');
    expect(geo?.rows[0].region).toBe('Nor•••');

    expect(analyticsExport.csv).not.toContain('North America');
    expect(analyticsExport.csv).not.toContain('jane@example.com');
    expect(analyticsExport.csv).not.toContain('usr_8f2a9b31');
    expect(analyticsExport.csv).toContain('Nor•••');
    expect(analyticsExport.csv).toContain('Personal Data,masked');
  });

  it('includes raw identifiers only when personal data was authorised', () => {
    const analyticsExport = buildAnalyticsExport(baseData, {
      account,
      includePersonalData: true,
    });

    expect(analyticsExport.personalDataIncluded).toBe(true);
    expect(analyticsExport.csv).toContain('North America');
    expect(analyticsExport.csv).toContain('jane@example.com');
    expect(analyticsExport.csv).toContain('usr_8f2a9b31');
    expect(analyticsExport.csv).toContain('Personal Data,included');
  });

  it('reports an empty export instead of a misleading range', () => {
    const emptyData: AnalyticsExportData = {
      ...baseData,
      engagementData: [],
      healthData: [],
      vaccinationData: [],
      geoData: [],
      apiUsageData: [],
    };

    const analyticsExport = buildAnalyticsExport(emptyData);

    expect(analyticsExport.dataRowCount).toBe(0);
    expect(analyticsExport.rowCount).toBe(1); // report metadata row only
    expect(analyticsExport.dateRange).toBeNull();
    expect(analyticsExport.csv).toContain('Range Start,unavailable');
    // Column headers stay in the file so the schema is still explicit.
    expect(analyticsExport.csv).toContain('date,activeUsers,newSignups');
  });

  it('handles boundary inputs: bad timestamps, single-day ranges and no account', () => {
    expect(resolveExportDateRange('not-a-date', 3)).toBeNull();
    expect(resolveExportDateRange('2026-10-26T12:00:00.000Z', 0)).toBeNull();

    const singleDay = resolveExportDateRange('2026-10-26T12:00:00.000Z', 1);
    expect(singleDay).toEqual({ startDate: '2026-10-26', endDate: '2026-10-26', days: 1 });

    const invalidTimestamp = buildAnalyticsExport({ ...baseData, timestamp: 'nope' });
    expect(invalidTimestamp.generatedAt).toBe('');
    expect(invalidTimestamp.dateRange).toBeNull();

    const withoutAccount = buildAnalyticsExport(baseData);
    const keys = allFields(withoutAccount).map((field) => field.key);
    expect(keys).not.toContain('account_id');
    expect(keys).not.toContain('account_email');

    const emailOnly = buildAnalyticsExport(baseData, { account: { email: 'jane@example.com' } });
    const emailKeys = allFields(emailOnly).map((field) => field.key);
    expect(emailKeys).toContain('account_email');
    expect(emailKeys).not.toContain('account_id');
  });

  it('escapes CSV cells that contain separators', () => {
    const analyticsExport = buildAnalyticsExport(baseData);
    expect(analyticsExport.csv).toContain('"Chronic, condition"');
  });

  it('excludes non-column data such as chart colours from rows', () => {
    const analyticsExport = buildAnalyticsExport(baseData);
    const health = analyticsExport.sections.find((section) => section.id === 'health');
    expect(health?.rows[0]).toEqual({ name: 'Healthy', value: 8 });
    expect(JSON.stringify(health?.rows)).not.toContain('#10B981');
  });
});

describe('downloadAnalyticsExport', () => {
  it('creates a blob download from the built CSV', () => {
    const createObjectURL = jest.fn(() => 'blob:analytics');
    const revokeObjectURL = jest.fn();
    const click = jest.fn();

    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const originalCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreate(tagName);
      if (tagName === 'a') {
        element.click = click;
      }
      return element;
    });

    const analyticsExport = buildAnalyticsExport(baseData, { account });
    downloadAnalyticsExport(analyticsExport);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:analytics');

    jest.restoreAllMocks();
  });
});
