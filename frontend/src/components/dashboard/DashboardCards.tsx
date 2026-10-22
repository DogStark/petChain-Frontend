import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface DashboardCard {
  id: string;
  title: string;
  description?: string;
  render?: () => React.ReactNode;
}

interface DashboardCardsProps {
  cards: DashboardCard[];
  /** Stable key used to persist the layout per account. */
  accountId?: string | null;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

interface StoredLayout {
  visible: string[];
  order: string[];
}

const STORAGE_PREFIX = 'petchain.dashboard.layout';

function storageKey(accountId?: string | null): string {
  return `${STORAGE_PREFIX}:${accountId ?? 'anonymous'}`;
}

function readLayout(key: string, storage: Pick<Storage, 'getItem'>): StoredLayout | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLayout>;
    if (!Array.isArray(parsed.visible) || !Array.isArray(parsed.order)) return null;
    return {
      visible: parsed.visible.filter((id): id is string => typeof id === 'string'),
      order: parsed.order.filter((id): id is string => typeof id === 'string'),
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the effective layout against the currently available cards.
 * Saved ids that no longer exist are dropped; any card missing from the
 * saved layout falls back to the default (visible, default order).
 */
function resolveLayout(cards: DashboardCard[], saved: StoredLayout | null): StoredLayout {
  const available = new Set(cards.map((c) => c.id));
  const defaultOrder = cards.map((c) => c.id);

  if (!saved) {
    return { visible: defaultOrder, order: defaultOrder };
  }

  const savedOrder = saved.order.filter((id) => available.has(id));
  const missing = defaultOrder.filter((id) => !savedOrder.includes(id));
  const order = [...savedOrder, ...missing];

  const savedVisible = saved.visible.filter((id) => available.has(id));
  const visible = order.filter((id) => savedVisible.includes(id));

  return { visible, order };
}

export const DashboardCards: React.FC<DashboardCardsProps> = ({
  cards,
  accountId,
  storage = typeof window !== 'undefined' ? window.localStorage : undefined,
}) => {
  const key = storageKey(accountId);
  const [layout, setLayout] = useState<StoredLayout>(() =>
    resolveLayout(cards, storage ? readLayout(key, storage) : null),
  );
  const [editing, setEditing] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Re-resolve whenever the available cards or account change so a saved
  // card that becomes unavailable restores the default layout.
  useEffect(() => {
    setLayout(resolveLayout(cards, storage ? readLayout(key, storage) : null));
  }, [cards, key, storage]);

  const persist = useCallback(
    (next: StoredLayout) => {
      setLayout(next);
      if (!storage) return;
      try {
        storage.setItem(key, JSON.stringify(next));
      } catch {
        // Persistence is best-effort; keep the in-memory layout.
      }
    },
    [key, storage],
  );

  const cardById = useMemo(() => {
    const map = new Map<string, DashboardCard>();
    cards.forEach((c) => map.set(c.id, c));
    return map;
  }, [cards]);

  const toggleVisible = (id: string) => {
    const isVisible = layout.visible.includes(id);
    const visible = isVisible
      ? layout.visible.filter((v) => v !== id)
      : [...layout.visible, id];
    persist({ ...layout, visible });
    setAnnouncement(
      `${cardById.get(id)?.title ?? id} ${isVisible ? 'hidden' : 'shown'}`,
    );
  };

  const move = (id: string, direction: -1 | 1) => {
    const order = [...layout.order];
    const index = order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    persist({ ...layout, order });
    setAnnouncement(
      `${cardById.get(id)?.title ?? id} moved to position ${target + 1} of ${order.length}`,
    );
  };

  const resetLayout = () => {
    const defaultOrder = cards.map((c) => c.id);
    persist({ visible: defaultOrder, order: defaultOrder });
    setAnnouncement('Dashboard layout reset to default');
  };

  const orderedCards = layout.order
    .map((id) => cardById.get(id))
    .filter((c): c is DashboardCard => Boolean(c));

  return (
    <section aria-labelledby="dashboard-cards-heading">
      <div className="dashboard-cards__toolbar">
        <h2 id="dashboard-cards-heading" ref={headingRef} tabIndex={-1}>
          Dashboard
        </h2>
        <button
          type="button"
          aria-pressed={editing}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'Done editing' : 'Edit layout'}
        </button>
      </div>

      <p role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </p>

      {editing ? (
        <div className="dashboard-cards__editor">
          <p id="dashboard-edit-help">
            Toggle cards to show or hide them, and use the move buttons to reorder.
          </p>
          <ol aria-describedby="dashboard-edit-help">
            {orderedCards.map((card, index) => {
              const isVisible = layout.visible.includes(card.id);
              return (
                <li key={card.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleVisible(card.id)}
                    />{' '}
                    {card.title}
                  </label>{' '}
                  <button
                    type="button"
                    onClick={() => move(card.id, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${card.title} up`}
                  >
                    ↑
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => move(card.id, 1)}
                    disabled={index === orderedCards.length - 1}
                    aria-label={`Move ${card.title} down`}
                  >
                    ↓
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={resetLayout}>
            Reset to default
          </button>
        </div>
      ) : null}

      <div className="dashboard-cards__grid">
        {orderedCards
          .filter((card) => layout.visible.includes(card.id))
          .map((card) => (
            <article key={card.id} aria-labelledby={`dashboard-card-${card.id}`}>
              <h3 id={`dashboard-card-${card.id}`}>{card.title}</h3>
              {card.description ? <p>{card.description}</p> : null}
              {card.render ? card.render() : null}
            </article>
          ))}
      </div>
    </section>
  );
};

export default DashboardCards;
