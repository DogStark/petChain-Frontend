import { useState, useEffect, useMemo } from 'react';
import { LabResultItem } from '@/types/lab-results';

const MOCK_RESULTS: LabResultItem[] = [
  {
    id: '1',
    testName: 'White Blood Cell Count',
    value: 12.5,
    category: 'Blood Work',
    date: '2024-10-15T10:00:00Z',
    referenceRange: { min: 5.5, max: 16.9, unit: 'K/uL' },
    isAbnormal: false,
  },
  {
    id: '2',
    testName: 'Red Blood Cell Count',
    value: 4.8,
    category: 'Blood Work',
    date: '2024-10-15T10:00:00Z',
    referenceRange: { min: 5.5, max: 8.5, unit: 'M/uL' },
    isAbnormal: true,
  },
  {
    id: '3',
    testName: 'Hemoglobin',
    value: 13.2,
    category: 'Blood Work',
    date: '2024-10-15T10:00:00Z',
    referenceRange: { min: 12.0, max: 18.0, unit: 'g/dL' },
    isAbnormal: false,
  },
  {
    id: '4',
    testName: 'Urine Specific Gravity',
    value: 1.045,
    category: 'Urinalysis',
    date: '2024-10-16T10:00:00Z',
    referenceRange: { min: 1.015, max: 1.05, unit: '' },
    isAbnormal: false,
  },
  {
    id: '5',
    testName: 'Urine Protein',
    value: '2+',
    category: 'Urinalysis',
    date: '2024-10-16T10:00:00Z',
    isAbnormal: true,
  },
  {
    id: '6',
    testName: 'Red Blood Cell Count',
    value: 5.9,
    category: 'Blood Work',
    date: '2024-04-10T10:00:00Z',
    referenceRange: { min: 5.5, max: 8.5, unit: 'M/uL' },
    isAbnormal: false,
  },
  {
    id: '7',
    testName: 'Red Blood Cell Count',
    value: 5.1,
    category: 'Blood Work',
    date: '2023-10-15T10:00:00Z',
    referenceRange: { min: 5.5, max: 8.5, unit: 'M/uL' },
    isAbnormal: true,
  },
];

export interface LabResultsSummary {
  total: number;
  abnormalCount: number;
  mostRecentDate: string | null;
}

export interface UseLabResultsReturn {
  results: LabResultItem[];
  summary: LabResultsSummary;
  recentResults: LabResultItem[];
  loading: boolean;
  error: string | null;
}

export function useLabResults(petId?: string): UseLabResultsReturn {
  const [results, setResults] = useState<LabResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Replace with real API: fetch(`/api/pets/${petId}/lab-results`)
    setLoading(true);
    const timer = setTimeout(() => {
      setResults(MOCK_RESULTS);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [petId]);

  const summary = useMemo<LabResultsSummary>(() => {
    const sorted = [...results].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return {
      total: results.length,
      abnormalCount: results.filter((r) => r.isAbnormal).length,
      mostRecentDate: sorted[0]?.date ?? null,
    };
  }, [results]);

  const recentResults = useMemo(
    () =>
      [...results]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
    [results]
  );

  return { results, summary, recentResults, loading, error };
}
