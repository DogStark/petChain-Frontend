export interface FormDraft<T = unknown> {
  data: T;
  savedAt: number;
  version: number;
}

const DRAFT_PREFIX = 'handsoff:draft:';
const DRAFT_VERSION = 1;

function storageKey(formId: string): string {
  return `${DRAFT_PREFIX}${formId}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveDraft<T>(formId: string, data: T): FormDraft<T> | null {
  const storage = getStorage();
  const draft: FormDraft<T> = {
    data,
    savedAt: Date.now(),
    version: DRAFT_VERSION,
  };
  if (!storage) return null;
  try {
    storage.setItem(storageKey(formId), JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

export function loadDraft<T>(formId: string): FormDraft<T> | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(formId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormDraft<T>;
    if (!parsed || parsed.version !== DRAFT_VERSION || typeof parsed.savedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(formId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(formId));
  } catch {
    // ignore storage failures
  }
}
