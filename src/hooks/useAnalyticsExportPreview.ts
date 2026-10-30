import { useCallback, useMemo, useRef, useState } from 'react';

import type {
  AnalyticsExport,
  AnalyticsExportData} from '@/lib/analytics/exportBuilder';
import {
  buildAnalyticsExport,
  readStoredExportAccount,
} from '@/lib/analytics/exportBuilder';
import { exportAccessAPI, PersonalDataAccessError } from '@/lib/api/exportAccessAPI';

/**
 * Privacy-aware analytics export preview.
 *
 * Defaults to a masked export and never turns personal data on by itself:
 * `requestPersonalData()` asks the backend, and only a positive, server-owned
 * answer flips `personalDataIncluded`. Denials and failures always fall back to
 * the masked export.
 */

export type PersonalDataStatus = 'masked' | 'requesting' | 'granted' | 'denied' | 'error';

export interface AnalyticsExportPreviewState {
  /** The export exactly as the preview describes it (and as it downloads). */
  analyticsExport: AnalyticsExport | null;
  /** True only after the backend authorised unmasked personal data. */
  personalDataIncluded: boolean;
  status: PersonalDataStatus;
  message: string | null;
  requesting: boolean;
  canDownload: boolean;
  requestPersonalData: () => Promise<void>;
  excludePersonalData: () => void;
}

const DENIED_FALLBACK_MESSAGE =
  'Personal data was not authorised for this export, so identifiers stay masked.';
const ERROR_FALLBACK_MESSAGE =
  'Could not verify personal-data access, so identifiers stay masked. Try again.';

function toMessage(error: unknown): { status: PersonalDataStatus; message: string } {
  if (error instanceof PersonalDataAccessError) {
    if (error.status === 401 || error.status === 403) {
      return { status: 'denied', message: error.message || DENIED_FALLBACK_MESSAGE };
    }
    return { status: 'error', message: error.message || ERROR_FALLBACK_MESSAGE };
  }
  return { status: 'error', message: ERROR_FALLBACK_MESSAGE };
}

export function useAnalyticsExportPreview(
  data: AnalyticsExportData | null,
): AnalyticsExportPreviewState {
  const [personalDataIncluded, setPersonalDataIncluded] = useState(false);
  const [status, setStatus] = useState<PersonalDataStatus>('masked');
  const [message, setMessage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const requestIdRef = useRef(0);

  const analyticsExport = useMemo(() => {
    if (!data) return null;
    return buildAnalyticsExport(data, {
      includePersonalData: personalDataIncluded,
      account: readStoredExportAccount(),
    });
  }, [data, personalDataIncluded]);

  const requestPersonalData = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setRequesting(true);
    setStatus('requesting');
    setMessage(null);

    try {
      const range = analyticsExport?.dateRange;
      const decision = await exportAccessAPI.requestPersonalDataAccess(
        range ? { startDate: range.startDate, endDate: range.endDate } : {},
      );
      if (requestId !== requestIdRef.current) return;

      if (decision.allowed) {
        setPersonalDataIncluded(true);
        setStatus('granted');
        setMessage(decision.message ?? 'Personal data included — authorised by the server.');
      } else {
        setPersonalDataIncluded(false);
        setStatus('denied');
        setMessage(decision.message ?? DENIED_FALLBACK_MESSAGE);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      const fallback = toMessage(error);
      setPersonalDataIncluded(false);
      setStatus(fallback.status);
      setMessage(fallback.message);
    } finally {
      if (requestId === requestIdRef.current) {
        setRequesting(false);
      }
    }
  }, [analyticsExport?.dateRange]);

  const excludePersonalData = useCallback(() => {
    // Invalidate any in-flight request so it can no longer unmask the export.
    requestIdRef.current += 1;
    setPersonalDataIncluded(false);
    setStatus('masked');
    setMessage(null);
    setRequesting(false);
  }, []);

  const canDownload = Boolean(analyticsExport && analyticsExport.dataRowCount > 0 && !requesting);

  return {
    analyticsExport,
    personalDataIncluded,
    status,
    message,
    requesting,
    canDownload,
    requestPersonalData,
    excludePersonalData,
  };
}
