'use client';

import { useCallback, useMemo, useState } from 'react';

export type EncounterSourceKind =
  | 'diagnosis'
  | 'treatment'
  | 'labResult'
  | 'followUp';

export interface EncounterSource {
  kind: EncounterSourceKind;
  id: string;
  label: string;
  attributedTo?: string;
  recordedAt?: string;
}

export interface EncounterSummaryItem {
  id: string;
  kind: EncounterSourceKind;
  text: string;
  source: EncounterSource;
}

export interface EncounterSummaryDraft {
  petId: string;
  encounterId?: string;
  items: EncounterSummaryItem[];
  followUpInstructions: string;
}

export interface EncounterSummaryCandidate {
  id: string;
  kind: EncounterSourceKind;
  text: string;
  source: EncounterSource;
}

export interface EncounterSummaryState {
  draft: EncounterSummaryDraft;
  candidates: EncounterSummaryCandidate[];
  selectedIds: string[];
  followUpInstructions: string;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  denied: boolean;
  isEmpty: boolean;
  toggleItem: (id: string) => void;
  setFollowUpInstructions: (value: string) => void;
  submit: () => Promise<void>;
  reset: () => void;
}

export interface UseEncounterSummaryOptions {
  petId: string;
  encounterId?: string;
  candidates?: EncounterSummaryCandidate[];
  onSubmit?: (draft: EncounterSummaryDraft) => Promise<void>;
}

const EMPTY_DRAFT: EncounterSummaryDraft = {
  petId: '',
  items: [],
  followUpInstructions: '',
};

/**
 * Assembles linked diagnoses, treatments, lab results, and follow-up
 * instructions into a single encounter summary with per-item source
 * attribution. Authorization and consent are decided by the backend; this
 * hook only surfaces the resulting state (including denied/empty) and never
 * makes access decisions itself.
 */
export function useEncounterSummary({
  petId,
  encounterId,
  candidates = [],
  onSubmit,
}: UseEncounterSummaryOptions): EncounterSummaryState {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [followUpInstructions, setFollowUpInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((existing) => existing !== id)
        : [...current, id],
    );
  }, []);

  const reset = useCallback(() => {
    setSelectedIds([]);
    setFollowUpInstructions('');
    setError(null);
    setDenied(false);
  }, []);

  const draft = useMemo<EncounterSummaryDraft>(() => {
    const items = candidates
      .filter((candidate) => selectedIds.includes(candidate.id))
      .map<EncounterSummaryItem>((candidate) => ({
        id: candidate.id,
        kind: candidate.kind,
        text: candidate.text,
        source: candidate.source,
      }));

    return {
      ...EMPTY_DRAFT,
      petId,
      encounterId,
      items,
      followUpInstructions: followUpInstructions.trim(),
    };
  }, [candidates, selectedIds, followUpInstructions, petId, encounterId]);

  const submit = useCallback(async () => {
    if (!onSubmit) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(draft);
    } catch (err) {
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status?: number }).status
          : undefined;
      if (status === 403) {
        setDenied(true);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to save the encounter summary.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, onSubmit]);

  return {
    draft,
    candidates,
    selectedIds,
    followUpInstructions,
    isLoading: false,
    isSubmitting,
    error,
    denied,
    isEmpty: candidates.length === 0,
    toggleItem,
    setFollowUpInstructions,
    submit,
    reset,
  };
}
