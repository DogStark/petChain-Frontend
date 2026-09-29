'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface MedicalRecord {
  id: string;
  date: string;
  title: string;
  description: string;
}

interface RecordsResponse {
  records: MedicalRecord[];
  nextCursor: string | null;
  total: number;
}

const ITEM_HEIGHT = 96;
const OVERSCAN = 6;
const PAGE_SIZE = 50;

async function fetchRecords(cursor: string | null): Promise<RecordsResponse> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  const res = await fetch(`/api/medical-records?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load medical records');
  return (await res.json()) as RecordsResponse;
}

function useVirtualList(count: number, viewportHeight: number, scrollTop: number) {
  return useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
    const visible = Math.ceil(viewportHeight / ITEM_HEIGHT) + OVERSCAN * 2;
    const end = Math.min(count, start + visible);
    return { start, end, offsetY: start * ITEM_HEIGHT, totalHeight: count * ITEM_HEIGHT };
  }, [count, viewportHeight, scrollTop]);
}

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<{ id: string; offset: number } | null>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const loadPage = useCallback(async (cursor: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecords(cursor);
      setRecords((prev) => (cursor ? [...prev, ...data.records] : data.records));
      setNextCursor(data.nextCursor);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(null);
  }, [loadPage]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    setViewportHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  const captureAnchor = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const top = el.scrollTop;
    const index = Math.floor(top / ITEM_HEIGHT);
    const record = records[index];
    if (record) {
      anchorRef.current = { id: record.id, offset: top - index * ITEM_HEIGHT };
    }
  }, [records]);

  const restoreAnchor = useCallback(() => {
    const anchor = anchorRef.current;
    const el = viewportRef.current;
    if (!anchor || !el) return;
    const index = records.findIndex((r) => r.id === anchor.id);
    if (index >= 0) {
      el.scrollTop = index * ITEM_HEIGHT + anchor.offset;
      setScrollTop(el.scrollTop);
    }
  }, [records]);

  useEffect(() => {
    restoreAnchor();
  }, [records, restoreAnchor]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loading || !nextCursor) return;
    captureAnchor();
    void loadPage(nextCursor);
  }, [captureAnchor, loadPage, loading, nextCursor]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const currentIndex = records.findIndex((r) => r.id === focusedId);
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = Math.min(records.length - 1, Math.max(0, currentIndex + delta));
      const next = records[nextIndex];
      if (!next) return;
      setFocusedId(next.id);
      itemRefs.current.get(next.id)?.focus();
    },
    [focusedId, records],
  );

  const { start, end, offsetY, totalHeight } = useVirtualList(
    records.length,
    viewportHeight,
    scrollTop,
  );
  const visible = records.slice(start, end);

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-2 text-2xl font-semibold">Medical Records</h1>
      <p className="mb-4 text-sm text-gray-600" aria-live="polite">
        {total} record{total === 1 ? '' : 's'} total, {records.length} loaded
      </p>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <div
        ref={viewportRef}
        onScroll={handleScroll}
        className="h-[600px] overflow-y-auto rounded border"
        data-testid="timeline-viewport"
      >
        <ul
          role="list"
          aria-label="Medical record timeline"
          aria-setsize={total}
          onKeyDown={handleKeyDown}
          style={{ height: totalHeight, position: 'relative' }}
        >
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visible.map((record) => (
              <li
                key={record.id}
                ref={(node) => {
                  if (node) itemRefs.current.set(record.id, node);
                  else itemRefs.current.delete(record.id);
                }}
                tabIndex={0}
                aria-posinset={records.indexOf(record) + 1}
                onFocus={() => setFocusedId(record.id)}
                style={{ height: ITEM_HEIGHT }}
                className="border-b p-3 focus:outline focus:outline-2 focus:outline-blue-500"
                data-testid={`record-${record.id}`}
              >
                <time className="text-xs text-gray-500">{record.date}</time>
                <h2 className="font-medium">{record.title}</h2>
                <p className="text-sm text-gray-700">{record.description}</p>
              </li>
            ))}
          </div>
        </ul>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loading || !nextCursor}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
        <span className="text-sm text-gray-600">
          Showing {records.length} of {total}
        </span>
      </div>
    </main>
  );
}
