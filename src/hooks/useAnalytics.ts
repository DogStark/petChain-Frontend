import { useState, useEffect } from 'react';
import { analyticsAPI, DateRange, AnalyticsReport } from '@/lib/api/analyticsAPI';

export const useAnalytics = (dateRange?: DateRange) => {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsAPI.getFullReport(dateRange);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const blob = await analyticsAPI.exportReport(format, dateRange);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics_${Date.now()}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateRange?.startDate, dateRange?.endDate]);

  return { report, loading, error, fetchReport, exportReport };
};
