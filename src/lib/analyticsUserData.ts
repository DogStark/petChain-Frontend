import { analyticsAPI } from './api/analyticsAPI';

export const generateAnalyticsData = async () => {
  // Engagement Data (Last 7 Days)
  const engagementData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      activeUsers: Math.floor(Math.random() * 50) + 100, // 100-150
      newSignups: Math.floor(Math.random() * 20) + 5, // 5-25
    };
  });

  // Pet Health Trends
  const healthData = [
    { name: 'Healthy', value: Math.floor(Math.random() * 200) + 300, color: '#10B981' }, // Green
    { name: 'Chronic Condition', value: Math.floor(Math.random() * 50) + 20, color: '#F59E0B' }, // Yellow
    { name: 'Critical', value: Math.floor(Math.random() * 20) + 5, color: '#EF4444' }, // Red
    { name: 'Recovering', value: Math.floor(Math.random() * 40) + 10, color: '#3B82F6' }, // Blue
  ];

  // Vaccination Compliance
  const vaccinationData = [
    { month: 'Jan', compliant: 85, nonCompliant: 15 },
    { month: 'Feb', compliant: 88, nonCompliant: 12 },
    { month: 'Mar', compliant: 92, nonCompliant: 8 },
    { month: 'Apr', compliant: 90, nonCompliant: 10 },
    { month: 'May', compliant: 94, nonCompliant: 6 },
    { month: 'Jun', compliant: 91, nonCompliant: 9 },
  ];

  // Geographic Usage - Call real backend
  let geoData = [
    { region: 'North America', users: 500 },
    { region: 'Europe', users: 300 },
    { region: 'Asia', users: 200 },
    { region: 'South America', users: 100 },
    { region: 'Africa', users: 50 },
    { region: 'Oceania', users: 20 },
  ];
  try {
    const geoDistribution = await analyticsAPI.getGeographicDistribution();
    geoData = geoDistribution.map(item => ({
      region: item.region,
      users: item.users,
    }));
  } catch (error) {
    console.error('Failed to fetch geographic distribution:', error);
  }

  // API Usage - Call real backend
  let apiUsageData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    requests: 100,
    errors: 0,
  }));
  try {
    const response = await fetch('/api/analytics/api-usage');
    if (response.ok) {
      apiUsageData = await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch API usage stats:', error);
  }

  return {
    engagementData,
    healthData,
    vaccinationData,
    geoData,
    apiUsageData,
    timestamp: new Date().toISOString(),
  };
};
