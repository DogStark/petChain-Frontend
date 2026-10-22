import { useCallback, useEffect, useMemo, useState } from 'react';

export interface DashboardCard {
  id: string;
  title: string;
  description?: string;
  /** Whether the backend currently allows this card to be shown for the account. */
  available: boolean;
}

export interface DashboardLayoutPreference {
  /** Ordered list of card ids the user has pinned/visible. */
  order: string[];
}

export interface DashboardLayoutStorage {
  load: (accountId: string) => DashboardLayoutPreference | null;
  save: (accountId: string, preference: DashboardLayoutPreference) => void;
}

const STORAGE_PREFIX = 'petchain.dashboard.layout';

function storageKey(accountId: string): string {
  return `${STORAGE_PREFIX}:${accountId}`;
}

function isBrowserStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

/**
 * Default persistence layer backed by localStorage, scoped per account.
 * Authorization/consent is never decided here; availability comes from the
 * backend-provided card list.
 */
export const localStorageDashboardLayoutStorage: DashboardLayoutStorage = {
  load(accountId) {
    if (!isBrowserStorageAvailable()) return null;
    try {
      const raw = window.localStorage.getItem(storageKey(accountId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as DashboardLayoutPreference).order) &&
        (parsed as DashboardLayoutPreference).order.every((id) => typeof id === 'string')
      ) {
        return { order: (parsed as DashboardLayoutPreference).order };
      }
      return null;
    } catch {
      return null;
    }
  },
  save(accountId, preference) {
    if (!isBrowserStorageAvailable()) return;
    try {
      window.localStorage.setItem(storageKey(accountId), JSON.stringify(preference));
    } catch {
      // Persistence is best-effort; ignore quota/security errors.
    }
  },
};

/**
 * Compute the effective ordered card list from the available cards and a saved
 * preference. Saved ids that are no longer available are dropped; available
 * cards missing from the saved order are appended in their default order. When
 * nothing usable remains, the default layout is restored.
 */
export function resolveDashboardLayout(
  cards: DashboardCard[],
  preference: DashboardLayoutPreference | null,
): DashboardCard[] {
  const availableById = new Map<string, DashboardCard>();
  for (const card of cards) {
    if (card.available) availableById.set(card.id, card);
  }

  const defaultOrder = cards.filter((card) => card.available);

  if (!preference || preference.order.length === 0) {
    return defaultOrder;
  }

  const seen = new Set<string>();
  const ordered: DashboardCard[] = [];
  for (const id of preference.order) {
    const card = availableById.get(id);
    if (card && !seen.has(id)) {
      seen.add(id);
      ordered.push(card);
    }
  }

  for (const card of defaultOrder) {
    if (!seen.has(card.id)) {
      seen.add(card.id);
      ordered.push(card);
    }
  }

  // If the saved preference referenced only unavailable cards, fall back to the
  // default layout rather than showing a partial/empty result.
  if (ordered.length === 0) {
    return defaultOrder;
  }

  return ordered;
}

export interface UseDashboardLayoutOptions {
  accountId: string | null | undefined;
  cards: DashboardCard[];
  storage?: DashboardLayoutStorage;
}

export interface UseDashboardLayoutResult {
  /** Cards in their effective display order. */
  orderedCards: DashboardCard[];
  /** Cards currently visible (pinned) in the effective layout. */
  visibleCards: DashboardCard[];
  /** Cards available from the backend but not currently pinned. */
  hiddenCards: DashboardCard[];
  isEditing: boolean;
  beginEdit: () => void;
  cancelEdit: () => void;
  /** Persist the current draft order and exit edit mode. */
  saveLayout: () => void;
  /** Toggle a card's visibility in the draft layout. */
  toggleCard: (cardId: string) => void;
  /** Move a card up/down within the draft order (keyboard-friendly). */
  moveCard: (cardId: string, direction: 'up' | 'down') => void;
  /** Restore the default layout for the account. */
  resetLayout: () => void;
  /** Draft order used while editing. */
  draftOrder: string[];
}

export function useDashboardLayout({
  accountId,
  cards,
  storage = localStorageDashboardLayoutStorage,
}: UseDashboardLayoutOptions): UseDashboardLayoutResult {
  const [preference, setPreference] = useState<DashboardLayoutPreference | null>(null);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Load the saved preference whenever the account changes.
  useEffect(() => {
    if (!accountId) {
      setPreference(null);
      return;
    }
    setPreference(storage.load(accountId));
  }, [accountId, storage]);

  const orderedCards = useMemo(
    () => resolveDashboardLayout(cards, preference),
    [cards, preference],
  );

  const availableCards = useMemo(() => cards.filter((card) => card.available), [cards]);

  const beginEdit = useCallback(() => {
    setDraftOrder(orderedCards.map((card) => card.id));
    setIsEditing(true);
  }, [orderedCards]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraftOrder([]);
  }, []);

  const persist = useCallback(
    (order: string[]) => {
      const next: DashboardLayoutPreference = { order };
      setPreference(next);
      if (accountId) storage.save(accountId, next);
    },
    [accountId, storage],
  );

  const saveLayout = useCallback(() => {
    persist(draftOrder);
    setIsEditing(false);
  }, [draftOrder, persist]);

  const toggleCard = useCallback(
    (cardId: string) => {
      setDraftOrder((current) => {
        if (current.includes(cardId)) {
          return current.filter((id) => id !== cardId);
        }
        return [...current, cardId];
      });
    },
    [],
  );

  const moveCard = useCallback((cardId: string, direction: 'up' | 'down') => {
    setDraftOrder((current) => {
      const index = current.indexOf(cardId);
      if (index === -1) return current;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    setPreference(null);
    setDraftOrder([]);
    setIsEditing(false);
    if (accountId) storage.save(accountId, { order: [] });
  }, [accountId, storage]);

  const visibleCards = orderedCards;
  const hiddenCards = useMemo(
    () => availableCards.filter((card) => !orderedCards.some((c) => c.id === card.id)),
    [availableCards, orderedCards],
  );

  return {
    orderedCards,
    visibleCards,
    hiddenCards,
    isEditing,
    beginEdit,
    cancelEdit,
    saveLayout,
    toggleCard,
    moveCard,
    resetLayout,
    draftOrder,
  };
}
