
export const generateAnalyticsData = () => {
  // Engagement Data (Last 7 Days)
  const engagementData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      activeUsers: Math.floor(Math.random() * 50) + 100, // 100-150
      newSignups: Math.floor(Math.random() * 20) + 5,   // 5-25
    };
  });

  // Pet Health Trends
  const healthData = [
    { name: 'Healthy', value: Math.floor(Math.random() * 200) + 300, color: '#10B981' }, // Green
    { name: 'Chronic Condition', value: Math.floor(Math.random() * 50) + 20, color: '#F59E0B' }, // Yellow
    { name: 'Critical', value: Math.floor(Math.random() * 20) + 5, color: '#EF4444' },   // Red
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

  // Geographic Usage
  const geoData = [
    { region: 'North America', users: Math.floor(Math.random() * 1000) + 500 },
    { region: 'Europe', users: Math.floor(Math.random() * 800) + 300 },
    { region: 'Asia', users: Math.floor(Math.random() * 600) + 200 },
    { region: 'South America', users: Math.floor(Math.random() * 300) + 100 },
    { region: 'Africa', users: Math.floor(Math.random() * 200) + 50 },
    { region: 'Oceania', users: Math.floor(Math.random() * 150) + 20 },
  ];

  // API Usage
  const apiUsageData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    requests: Math.floor(Math.random() * 500) + 100,
    errors: Math.floor(Math.random() * 20),
  }));

  return {
    engagementData,
    healthData,
    vaccinationData,
    geoData,
    apiUsageData,
    timestamp: new Date().toISOString(),
  };
};
