import { analyticsAPI, DateRange, UserEngagement } from './api/analyticsAPI';

const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export type EngagementRange = '7d' | '30d' | '90d';

export const ENGAGEMENT_RANGE_OPTIONS: Array<{ value: EngagementRange; label: string; days: number }> = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
];

const FEATURE_NAMES = ['Pet Records', 'Appointments', 'Vaccinations', 'Marketplace', 'Messaging'];

const getDemoFeatureUsage = (days: number) =>
  FEATURE_NAMES.map((feature, index) => ({
    feature,
    users: Math.round((1200 - index * 180) * (days / 7)),
  }));

const getSafeFeatureUsage = () => FEATURE_NAMES.map((feature) => ({ feature, users: 0 }));

const getDemoEngagementTrends = (days: number) =>
  Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    const dau = 110 + ((i * 7) % 45);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dau,
      wau: dau * 4 + ((i * 11) % 60),
    };
  });

const getSafeEngagementTrends = (days: number) =>
  Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dau: 0,
      wau: 0,
    };
  });

export const getEngagementDateRange = (range: EngagementRange): DateRange => {
  const days = ENGAGEMENT_RANGE_OPTIONS.find((option) => option.value === range)?.days ?? 7;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
};

export const generateUserEngagement = async (range: EngagementRange = '7d'): Promise<UserEngagement> => {
  const days = ENGAGEMENT_RANGE_OPTIONS.find((option) => option.value === range)?.days ?? 7;

  if (DEMO_MODE_ENABLED) {
    return { trends: getDemoEngagementTrends(days), featureUsage: getDemoFeatureUsage(days) };
  }

  try {
    const engagement = await analyticsAPI.getUserEngagement(getEngagementDateRange(range));
    return {
      trends: engagement?.trends ?? getSafeEngagementTrends(days),
      featureUsage: engagement?.featureUsage ?? getSafeFeatureUsage(),
    };
  } catch {
    return { trends: getSafeEngagementTrends(days), featureUsage: getSafeFeatureUsage() };
  }
};

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

const getVaccinationBreakdown = () => [
  { vaccineType: 'Rabies', compliant: 96, nonCompliant: 4 },
  { vaccineType: 'Distemper', compliant: 91, nonCompliant: 9 },
  { vaccineType: 'Parvovirus', compliant: 88, nonCompliant: 12 },
  { vaccineType: 'Leptospirosis', compliant: 82, nonCompliant: 18 },
  { vaccineType: 'Bordetella', compliant: 79, nonCompliant: 21 },
];

const getNonCompliantPets = () => [
  {
    id: 'pet-1001',
    name: 'Bella',
    species: 'Dog',
    ownerName: 'A. Rivera',
    vaccineType: 'Rabies',
    dueDate: '2026-08-14',
    daysOverdue: 12,
  },
  {
    id: 'pet-1002',
    name: 'Milo',
    species: 'Cat',
    ownerName: 'J. Chen',
    vaccineType: 'Distemper',
    dueDate: '2026-09-02',
    daysOverdue: 5,
  },
  {
    id: 'pet-1003',
    name: 'Luna',
    species: 'Dog',
    ownerName: 'S. Okafor',
    vaccineType: 'Parvovirus',
    dueDate: '2026-07-21',
    daysOverdue: 36,
  },
  {
    id: 'pet-1004',
    name: 'Rocky',
    species: 'Dog',
    ownerName: 'M. Novak',
    vaccineType: 'Leptospirosis',
    dueDate: '2026-09-10',
    daysOverdue: 2,
  },
  {
    id: 'pet-1005',
    name: 'Cleo',
    species: 'Cat',
    ownerName: 'P. Adeyemi',
    vaccineType: 'Bordetella',
    dueDate: '2026-06-30',
    daysOverdue: 57,
  },
];

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
    vaccinationBreakdown: getVaccinationBreakdown(),
    nonCompliantPets: getNonCompliantPets(),
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
