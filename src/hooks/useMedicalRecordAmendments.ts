import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';

export interface RecordAmendment {
  id: string;
  recordId: string;
  editorId: string;
  editorName: string;
  timestamp: string;
  summary: string;
  diff?: string;
}

interface UseAmendmentsResult {
  amendments: RecordAmendment[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useMedicalRecordAmendments(recordId: string): UseAmendmentsResult {
  const [amendments, setAmendments] = useState<RecordAmendment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      const { data } = await axios.get<RecordAmendment[]>(
        `${getApiBaseUrl()}/medical-records/${recordId}/amendments`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setAmendments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load amendment history');
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { amendments, loading, error, reload: load };
}
