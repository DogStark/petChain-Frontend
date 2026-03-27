import { useState, useEffect, useCallback } from 'react';
import { gdprService, UserConsent, ConsentType } from '@/lib/gdpr';

export function useGdpr(userId: string) {
  const [consents, setConsents] = useState<UserConsent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gdprService.getConsents(userId);
      if (!data.length) {
        const defaults = await gdprService.initConsents(userId);
        setConsents(defaults);
      } else {
        setConsents(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load consents');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const updateConsent = useCallback(async (type: ConsentType, granted: boolean) => {
    try {
      const updated = await gdprService.updateConsent(userId, type, granted);
      setConsents((prev) => prev.map((c) => (c.type === type ? updated : c)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update consent');
    }
  }, [userId]);

  const exportData = useCallback(async () => {
    setLoading(true);
    try { await gdprService.exportData(userId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Export failed'); }
    finally { setLoading(false); }
  }, [userId]);

  const requestDeletion = useCallback(async (reason?: string) => {
    setLoading(true);
    try { return await gdprService.requestDeletion(userId, reason); }
    catch (e) { setError(e instanceof Error ? e.message : 'Deletion request failed'); return null; }
    finally { setLoading(false); }
  }, [userId]);

  return { consents, loading, error, updateConsent, exportData, requestDeletion };
}
