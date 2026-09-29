import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface MedicalRecord {
  id: string;
  title: string;
  date: string;
  summary?: string;
}

export interface MedicalRecordTimelineProps {
  records: MedicalRecord[];
  /** Called when the user scrolls near the end to load the next page. */
  onLoadMore?: () => void;
  /** True while a page of records is being fetched. */
  isLoadingMore?: boolean;
  /** True when there are no further pages to load. */
  hasMore?: boolean;
  /** Fixed row height in px, used for virtualization math. */
  itemHeight?: number;
  /** Height of the scroll viewport in px. */
  viewportHeight?: number;
  /** Number of extra rows rendered above/below the viewport. */
  overscan?: number;
  /** Optional label describing the timeline for assistive tech. */
  ariaLabel?: string;
}

const DEFAULT_ITEM_HEIGHT = 72;
const DEFAULT_VIEWPORT_HEIGHT = 480;
const DEFAULT_OVERSCAN = 4;

/**
 * Virtualized medical record timeline.
 *
 * - Only the visible window of rows is rendered, keeping large histories
 *   responsive.
 * - The scroll anchor (the record currently at the top of the viewport) is
 *   preserved when new pages are appended, so loading a page does not jump
 *   the visible record.
 * - Keyboard focus is restored to the same record after pagination or filter
 *   changes.
 * - An accessible live count of rendered/total records is exposed.
 */
export function MedicalRecordTimeline({
  records,
  onLoadMore,
  isLoadingMore = false,
  hasMore = false,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  ariaLabel = 'Medical record timeline',
}: MedicalRecordTimelineProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Anchor bookkeeping: remember which record was at the top of the viewport
  // and which record held keyboard focus, so we can restore them after the
  // list grows or is filtered.
  const anchorIdRef = useRef<string | null>(null);
  const focusedIdRef = useRef<string | null>(null);
  const prevCountRef = useRef(records.length);

  const total = records.length;
  const totalHeight = total * itemHeight;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    total,
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan,
  );

  const visibleRecords = useMemo(
    () => records.slice(startIndex, endIndex),
    [records, startIndex, endIndex],
  );

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const nextScrollTop = event.currentTarget.scrollTop;
      setScrollTop(nextScrollTop);

      const topIndex = Math.floor(nextScrollTop / itemHeight);
      const topRecord = records[topIndex];
      if (topRecord) {
        anchorIdRef.current = topRecord.id;
      }

      if (
        hasMore &&
        !isLoadingMore &&
        onLoadMore &&
        nextScrollTop + viewportHeight >= totalHeight - itemHeight * overscan
      ) {
        onLoadMore();
      }
    },
    [
      records,
      itemHeight,
      hasMore,
      isLoadingMore,
      onLoadMore,
      viewportHeight,
      totalHeight,
      overscan,
    ],
  );

  // Preserve the scroll anchor when the record set changes (pagination or
  // filtering). Runs before paint to avoid a visible jump.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      prevCountRef.current = records.length;
      return;
    }

    const anchorId = anchorIdRef.current;
    if (anchorId) {
      const anchorIndex = records.findIndex((record) => record.id === anchorId);
      if (anchorIndex >= 0) {
        const desiredTop = anchorIndex * itemHeight;
        if (Math.abs(viewport.scrollTop - desiredTop) > 1) {
          viewport.scrollTop = desiredTop;
          setScrollTop(desiredTop);
        }
      }
    }

    prevCountRef.current = records.length;
  }, [records, itemHeight]);

  // Restore keyboard focus to the record that previously held it.
  useEffect(() => {
    const focusedId = focusedIdRef.current;
    if (!focusedId) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const target = viewport.querySelector<HTMLElement>(
      `[data-record-id="${focusedId}"]`,
    );
    if (target && document.activeElement !== target) {
      target.focus({ preventScroll: true });
    }
  }, [records]);

  const handleItemFocus = useCallback((id: string) => {
    focusedIdRef.current = id;
  }, []);

  const renderedCount = visibleRecords.length;

  return (
    <section aria-label={ariaLabel}>
      <p
        role="status"
        aria-live="polite"
        data-testid="timeline-count"
        style={{ margin: '0 0 8px', fontSize: 13, color: '#555' }}
      >
        Showing {renderedCount} of {total} medical records
        {isLoadingMore ? ' (loading more…)' : ''}
      </p>
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        data-testid="timeline-viewport"
        style={{
          height: viewportHeight,
          overflowY: 'auto',
          position: 'relative',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
        }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleRecords.map((record, offset) => {
            const index = startIndex + offset;
            return (
              <div
                key={record.id}
                data-record-id={record.id}
                data-testid={`timeline-item-${record.id}`}
                tabIndex={0}
                onFocus={() => handleItemFocus(record.id)}
                style={{
                  position: 'absolute',
                  top: index * itemHeight,
                  left: 0,
                  right: 0,
                  height: itemHeight,
                  boxSizing: 'border-box',
                  padding: '8px 12px',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div style={{ fontWeight: 600 }}>{record.title}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{record.date}</div>
                {record.summary ? (
                  <div style={{ fontSize: 13, color: '#333' }}>
                    {record.summary}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default MedicalRecordTimeline;
