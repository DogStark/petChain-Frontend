import { useCallback, useEffect, useMemo, useState } from 'react';
import { emergencyProfileApi } from '../lib/api/emergencyProfile';

export interface LostPetPublicDetails {
  petName: string;
  species?: string;
  breed?: string;
  color?: string;
  lastSeenLocation?: string;
  lastSeenAt?: string;
  contactInstructions?: string;
  photoUrl?: string;
}

export interface LostPetReport {
  id: string;
  petId: string;
  status: 'active' | 'closed';
  publicDetails: LostPetPublicDetails;
  createdAt: string;
  closedAt?: string;
}

export type LostPetReportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'active'; report: LostPetReport }
  | { status: 'none' }
  | { status: 'denied'; message: string }
  | { status: 'error'; message: string };

export interface UseLostPetReportResult {
  state: LostPetReportState;
  isSubmitting: boolean;
  /** Public details the owner is about to publish, for review before confirming. */
  draftDetails: LostPetPublicDetails | null;
  /** Load the current report (if any) for a pet. */
  refresh: () => Promise<void>;
  /** Prepare the public details preview without publishing. */
  prepareDraft: (details: LostPetPublicDetails) => void;
  /** Publish the lost-pet alert. Backend owns authorization/consent. */
  markMissing: (details: LostPetPublicDetails) => Promise<boolean>;
  /** Close the alert after the pet is recovered. */
  markRecovered: () => Promise<boolean>;
}

function isDeniedError(error: unknown): boolean {
  const status = (error as { status?: number; response?: { status?: number } })?.status
    ?? (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

/**
 * Manages the lost-pet report lifecycle for a single pet: review the public
 * details, publish the alert, and close it after recovery. All authorization
 * and consent decisions are delegated to the backend.
 */
export function useLostPetReport(petId: string | undefined): UseLostPetReportResult {
  const [state, setState] = useState<LostPetReportState>({ status: 'idle' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftDetails, setDraftDetails] = useState<LostPetPublicDetails | null>(null);

  const refresh = useCallback(async () => {
    if (!petId) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    try {
      const report = await emergencyProfileApi.getLostPetReport(petId);
      if (report && report.status === 'active') {
        setState({ status: 'active', report });
        setDraftDetails(report.publicDetails);
      } else {
        setState({ status: 'none' });
      }
    } catch (error) {
      if (isDeniedError(error)) {
        setState({ status: 'denied', message: 'You do not have access to this pet.' });
      } else {
        setState({ status: 'error', message: errorMessage(error) });
      }
    }
  }, [petId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const prepareDraft = useCallback((details: LostPetPublicDetails) => {
    setDraftDetails(details);
  }, []);

  const markMissing = useCallback(
    async (details: LostPetPublicDetails) => {
      if (!petId) return false;
      setIsSubmitting(true);
      try {
        const report = await emergencyProfileApi.createLostPetReport(petId, details);
        setDraftDetails(report.publicDetails);
        setState({ status: 'active', report });
        return true;
      } catch (error) {
        if (isDeniedError(error)) {
          setState({ status: 'denied', message: 'You are not allowed to report this pet as missing.' });
        } else {
          setState({ status: 'error', message: errorMessage(error) });
        }
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [petId],
  );

  const markRecovered = useCallback(async () => {
    if (!petId || state.status !== 'active') return false;
    setIsSubmitting(true);
    try {
      await emergencyProfileApi.closeLostPetReport(petId, state.report.id);
      setState({ status: 'none' });
      setDraftDetails(null);
      return true;
    } catch (error) {
      if (isDeniedError(error)) {
        setState({ status: 'denied', message: 'You are not allowed to close this alert.' });
      } else {
        setState({ status: 'error', message: errorMessage(error) });
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [petId, state]);

  return useMemo(
    () => ({ state, isSubmitting, draftDetails, refresh, prepareDraft, markMissing, markRecovered }),
    [state, isSubmitting, draftDetails, refresh, prepareDraft, markMissing, markRecovered],
  );
}

export default useLostPetReport;
