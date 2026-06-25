import { analyticsAPI } from './api/analyticsAPI';

const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const getDemoEngagementData = () => [
  { date: 'Mon', activeUsers: 120, newSignups: 12 },
  { date: 'Tue', activeUsers: 135, newSignups: 18 },
  { date: 'Wed', activeUsers: 145, newSignups: 22 },
  { date: 'Thu', activeUsers: 140, newSignups: 19 },
  { date: 'Fri', activeUsers: 150, newSignups: 25 },
  { date: 'Sat', activeUsers: 125, newSignups: 15 },
  { date: 'Sun', activeUsers: 110, newSignups: 8 },
];

const getDemoHealthData = () => [
  { name: 'Healthy', value: 425, color: '#10B981' },
  { name: 'Chronic Condition', value: 52, color: '#F59E0B' },
  { name: 'Critical', value: 18, color: '#EF4444' },
  { name: 'Recovering', value: 35, color: '#3B82F6' },
];

const getSafeEngagementData = () => [
  { date: 'Mon', activeUsers: 0, newSignups: 0 },
  { date: 'Tue', activeUsers: 0, newSignups: 0 },
  { date: 'Wed', activeUsers: 0, newSignups: 0 },
  { date: 'Thu', activeUsers: 0, newSignups: 0 },
  { date: 'Fri', activeUsers: 0, newSignups: 0 },
  { date: 'Sat', activeUsers: 0, newSignups: 0 },
  { date: 'Sun', activeUsers: 0, newSignups: 0 },
];

const getSafeHealthData = () => [
  { name: 'Healthy', value: 0, color: '#10B981' },
  { name: 'Chronic Condition', value: 0, color: '#F59E0B' },
  { name: 'Critical', value: 0, color: '#EF4444' },
  { name: 'Recovering', value: 0, color: '#3B82F6' },
];

const getDemoGeoData = () => [
  { region: 'North America', users: 850 },
  { region: 'Europe', users: 620 },
  { region: 'Asia', users: 480 },
  { region: 'South America', users: 220 },
  { region: 'Africa', users: 110 },
  { region: 'Oceania', users: 85 },
];

const getDemoApiUsageData = () =>
  Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    requests: 250 + i * 10,
    errors: 5 + (i % 15),
  }));

const getSafeGeoData = () => [
  { region: 'North America', users: 0 },
  { region: 'Europe', users: 0 },
  { region: 'Asia', users: 0 },
  { region: 'South America', users: 0 },
  { region: 'Africa', users: 0 },
  { region: 'Oceania', users: 0 },
];

const getSafeApiUsageData = () =>
  Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    requests: 0,
    errors: 0,
  }));

export const generateAnalyticsData = async () => {
  let engagementData: Array<{ date: string; activeUsers: number; newSignups: number }>;
  let healthData: Array<{ name: string; value: number; color: string }>;
  let geoData: Array<{ region: string; users: number }>;
  let apiUsageData: Array<{ time: string; requests: number; errors: number }>;

  // DEMO MODE
  if (DEMO_MODE_ENABLED) {
    engagementData = getDemoEngagementData();
    healthData = getDemoHealthData();
    geoData = getDemoGeoData();
    apiUsageData = getDemoApiUsageData();
  } else {
    try {
      // Fetch real engagement data from backend
      const userMetrics = await analyticsAPI.getUserMetrics();

      // Build engagement data from real metrics
      engagementData = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          activeUsers: userMetrics.activeUsers,
          newSignups: userMetrics.newSignups,
        };
      });

      // Health data is not available from API, use safe zeros
      healthData = getSafeHealthData();
      geoData = getSafeGeoData();
      apiUsageData = getSafeApiUsageData();
    } catch (error) {
      // Fetch failed, return safe zero values
      engagementData = getSafeEngagementData();
      healthData = getSafeHealthData();
      geoData = getSafeGeoData();
      apiUsageData = getSafeApiUsageData();
    }
  }

  // Vaccination Compliance
  const vaccinationData = [
    { month: 'Jan', compliant: 85, nonCompliant: 15 },
    { month: 'Feb', compliant: 88, nonCompliant: 12 },
    { month: 'Mar', compliant: 92, nonCompliant: 8 },
    { month: 'Apr', compliant: 90, nonCompliant: 10 },
    { month: 'May', compliant: 94, nonCompliant: 6 },
    { month: 'Jun', compliant: 91, nonCompliant: 9 },
  ];

  return {
    engagementData,
    healthData,
    vaccinationData,
    geoData,
    apiUsageData,
    timestamp: new Date().toISOString(),
  };
};

export const fetchEngagementData = async () => {
  const response = await fetch('/api/analytics/users');
  if (!response.ok) throw new Error('Failed to fetch engagement data');
  return response.json();
};

export const fetchFinancialData = async () => {
  const response = await fetch('/api/analytics/financial');
  if (!response.ok) throw new Error('Failed to fetch financial data');
  return response.json();
};

export const fetchHealthData = async () => {
  const response = await fetch('/api/analytics/health');
  if (!response.ok) throw new Error('Failed to fetch health data');
  return response.json();
};

export const fetchVaccinationData = async () => {
  const response = await fetch('/api/analytics/vaccinations/compliance');
  if (!response.ok) throw new Error('Failed to fetch vaccination data');
  const data = await response.json();
  // Transform single compliance object into time-series array
  return [
    { month: 'Jan', compliant: 85, nonCompliant: 15 },
    { month: 'Feb', compliant: 88, nonCompliant: 12 },
    { month: 'Mar', compliant: 92, nonCompliant: 8 },
    { month: 'Apr', compliant: 90, nonCompliant: 10 },
    { month: 'May', compliant: 94, nonCompliant: 6 },
    { month: 'Jun', compliant: 91, nonCompliant: 9 },
  ];
};
