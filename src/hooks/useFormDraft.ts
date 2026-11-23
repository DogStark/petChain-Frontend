import { useCallback, useEffect, useRef, useState } from 'react';
import { clearDraft, loadDraft, saveDraft, type FormDraft } from '../lib/draftStore';

export const DRAFT_AUTOSAVE_INTERVAL_MS = 30_000;

export interface UseFormDraftOptions<T> {
  formId: string;
  data: T;
  enabled?: boolean;
  intervalMs?: number;
}

export interface UseFormDraftResult<T> {
  pendingDraft: FormDraft<T> | null;
  restoreDraft: () => FormDraft<T> | null;
  discardDraft: () => void;
  clearOnSubmit: () => void;
  lastSavedAt: number | null;
}

export function useFormDraft<T>({
  formId,
  data,
  enabled = true,
  intervalMs = DRAFT_AUTOSAVE_INTERVAL_MS,
}: UseFormDraftOptions<T>): UseFormDraftResult<T> {
  const [pendingDraft, setPendingDraft] = useState<FormDraft<T> | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!enabled) return;
    const existing = loadDraft<T>(formId);
    if (existing) {
      setPendingDraft(existing);
    }
  }, [formId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      const saved = saveDraft(formId, dataRef.current);
      if (saved) setLastSavedAt(saved.savedAt);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [formId, enabled, intervalMs]);

  const restoreDraft = useCallback(() => {
    const draft = pendingDraft;
    setPendingDraft(null);
    return draft;
  }, [pendingDraft]);

  const discardDraft = useCallback(() => {
    clearDraft(formId);
    setPendingDraft(null);
  }, [formId]);

  const clearOnSubmit = useCallback(() => {
    clearDraft(formId);
    setPendingDraft(null);
    setLastSavedAt(null);
  }, [formId]);

  return { pendingDraft, restoreDraft, discardDraft, clearOnSubmit, lastSavedAt };
}
