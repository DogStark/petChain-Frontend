import * as analyticsUserDataModule from './analyticsUserData';
import * as analyticsAPIModule from './api/analyticsAPI';

jest.mock('./api/analyticsAPI');

const mockUserMetrics = {
  totalUsers: 1000,
  activeUsers: 150,
  newSignups: 20,
  retentionRate: 0.85,
};

describe('generateAnalyticsData', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
  });

  it('returns real API values when NEXT_PUBLIC_DEMO_MODE is not set', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = undefined;

    (analyticsAPIModule.analyticsAPI.getUserMetrics as jest.Mock).mockResolvedValue(
      mockUserMetrics
    );

    // Need to require after setting env var
    const { generateAnalyticsData } = require('./analyticsUserData');

    const result = await generateAnalyticsData();

    expect(result.engagementData).toHaveLength(7);
    expect(result.engagementData[0].activeUsers).toBe(mockUserMetrics.activeUsers);
    expect(result.engagementData[0].newSignups).toBe(mockUserMetrics.newSignups);
    expect(analyticsAPIModule.analyticsAPI.getUserMetrics).toHaveBeenCalled();
  });

  it('returns demo static values when NEXT_PUBLIC_DEMO_MODE is "true"', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

    // Need to require after setting env var
    const { generateAnalyticsData } = require('./analyticsUserData');

    const result = await generateAnalyticsData();

    expect(result.engagementData).toHaveLength(7);
    expect(result.engagementData[0]).toEqual({
      date: 'Mon',
      activeUsers: 120,
      newSignups: 12,
    });
    expect(result.healthData[0]).toEqual({
      name: 'Healthy',
      value: 425,
      color: '#10B981',
    });
    expect(analyticsAPIModule.analyticsAPI.getUserMetrics).not.toHaveBeenCalled();
  });

  it('returns safe zero values when API fetch fails', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = undefined;

    (analyticsAPIModule.analyticsAPI.getUserMetrics as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );

    const { generateAnalyticsData } = require('./analyticsUserData');

    const result = await generateAnalyticsData();

    expect(result.engagementData).toHaveLength(7);
    expect(result.engagementData.every((d) => d.activeUsers === 0)).toBe(true);
    expect(result.engagementData.every((d) => d.newSignups === 0)).toBe(true);
    expect(result.healthData.every((h) => h.value === 0)).toBe(true);
    expect(result.geoData.every((g) => g.users === 0)).toBe(true);
    expect(result.apiUsageData.every((a) => a.requests === 0 && a.errors === 0)).toBe(true);
  });

  it('includes vacation compliance data', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

    const { generateAnalyticsData } = require('./analyticsUserData');

    const result = await generateAnalyticsData();

    expect(result.vaccinationData).toBeDefined();
    expect(result.vaccinationData).toHaveLength(6);
    expect(result.vaccinationData[0]).toEqual({
      month: 'Jan',
      compliant: 85,
      nonCompliant: 15,
    });
  });

  it('includes timestamp', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

    const { generateAnalyticsData } = require('./analyticsUserData');

    const result = await generateAnalyticsData();

    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe('string');
    // Verify ISO format
    expect(/^\d{4}-\d{2}-\d{2}T/.test(result.timestamp)).toBe(true);
  });

  it('contains all required data structures', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

    const { generateAnalyticsData } = require('./analyticsUserData');

    const result = await generateAnalyticsData();

    expect(result).toHaveProperty('engagementData');
    expect(result).toHaveProperty('healthData');
    expect(result).toHaveProperty('vaccinationData');
    expect(result).toHaveProperty('geoData');
    expect(result).toHaveProperty('apiUsageData');
    expect(result).toHaveProperty('timestamp');
  });

  it('geo data has no randomness in demo mode', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

    const { generateAnalyticsData } = require('./analyticsUserData');

    const result1 = await generateAnalyticsData();
    const result2 = await generateAnalyticsData();

    expect(result1.geoData).toEqual(result2.geoData);
  });

  it('api usage data has no randomness in demo mode', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

    const { generateAnalyticsData } = require('./analyticsUserData');

    const result1 = await generateAnalyticsData();
    const result2 = await generateAnalyticsData();

    expect(result1.apiUsageData).toEqual(result2.apiUsageData);
  });

  it('never uses Math.random in any path', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = undefined;

    const mathRandomSpy = jest.spyOn(Math, 'random');

    (analyticsAPIModule.analyticsAPI.getUserMetrics as jest.Mock).mockResolvedValue(
      mockUserMetrics
    );

    const { generateAnalyticsData } = require('./analyticsUserData');
    await generateAnalyticsData();

    expect(mathRandomSpy).not.toHaveBeenCalled();

    mathRandomSpy.mockRestore();
  });
});
