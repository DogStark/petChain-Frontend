'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface MedicalRecord {
  id: string;
  date: string;
  category: string;
  title: string;
  summary: string;
  source: string;
  sensitive?: boolean;
}

interface PacketResponse {
  petName: string;
  records: MedicalRecord[];
}

const SENSITIVE_CATEGORIES = ['behavioral', 'reproductive', 'genetic'];

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function MedicalHistoryPrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const petId = params?.id;
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  const [packet, setPacket] = useState<PacketResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'denied' | 'error'>(
    'loading',
  );
  const [excludeSensitive, setExcludeSensitive] = useState(true);

  useEffect(() => {
    if (!petId) return;
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus('loading');
      try {
        const query = new URLSearchParams();
        if (from) query.set('from', from);
        if (to) query.set('to', to);
        const res = await fetch(
          `/api/pets/${encodeURIComponent(petId)}/medical-history?${query.toString()}`,
          { signal: controller.signal, credentials: 'include' },
        );
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setStatus('denied');
          return;
        }
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const data: PacketResponse = await res.json();
        if (cancelled) return;
        setPacket(data);
        setStatus(data.records.length === 0 ? 'empty' : 'ready');
      } catch (err) {
        if (cancelled || (err as Error).name === 'AbortError') return;
        setStatus('error');
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [petId, from, to]);

  const visibleRecords = useMemo(() => {
    if (!packet) return [];
    return packet.records
      .filter((r) => !excludeSensitive || !(r.sensitive || SENSITIVE_CATEGORIES.includes(r.category)))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [packet, excludeSensitive]);

  const sections = useMemo(() => {
    const map = new Map<string, MedicalRecord[]>();
    for (const record of visibleRecords) {
      const key = record.category || 'other';
      const list = map.get(key) ?? [];
      list.push(record);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [visibleRecords]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0">
      <header className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-semibold">
          Longitudinal Medical History{packet ? ` — ${packet.petName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {from || to
            ? `Date range: ${from ? formatDate(from) : 'beginning'} – ${to ? formatDate(to) : 'present'}`
            : 'Full history'}
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-4 print:hidden">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={excludeSensitive}
            onChange={(e) => setExcludeSensitive(e.target.checked)}
            aria-describedby="sensitive-hint"
          />
          Exclude sensitive categories
        </label>
        <span id="sensitive-hint" className="text-xs text-gray-500">
          Behavioral, reproductive, and genetic records are hidden by default.
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          disabled={status !== 'ready'}
        >
          Print packet
        </button>
      </div>

      {status === 'loading' && (
        <p role="status" className="text-sm text-gray-600">
          Loading medical history…
        </p>
      )}

      {status === 'denied' && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          You do not have permission to view this pet’s medical history.
        </p>
      )}

      {status === 'error' && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Something went wrong while loading the medical history. Please try again.
        </p>
      )}

      {status === 'empty' && (
        <p role="status" className="text-sm text-gray-600">
          No records found for the selected date range.
        </p>
      )}

      {status === 'ready' && visibleRecords.length === 0 && (
        <p role="status" className="text-sm text-gray-600">
          All records in this range are in sensitive categories and are currently excluded.
        </p>
      )}

      {status === 'ready' && visibleRecords.length > 0 && (
        <>
          <nav aria-label="Table of contents" className="mb-8 rounded border p-4">
            <h2 className="mb-2 text-lg font-semibold">Table of Contents</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {sections.map(([category, records]) => (
                <li key={category}>
                  <a href={`#section-${slugify(category)}`} className="underline">
                    {category} ({records.length})
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {sections.map(([category, records]) => (
            <section
              key={category}
              id={`section-${slugify(category)}`}
              aria-labelledby={`heading-${slugify(category)}`}
              className="mb-8"
            >
              <h2 id={`heading-${slugify(category)}`} className="mb-3 text-xl font-semibold">
                {category}
              </h2>
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{category} records</caption>
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="py-2 pr-3">Date</th>
                    <th scope="col" className="py-2 pr-3">Record</th>
                    <th scope="col" className="py-2 pr-3">Summary</th>
                    <th scope="col" className="py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(record.date)}</td>
                      <th scope="row" className="py-2 pr-3 text-left font-medium">
                        {record.title}
                      </th>
                      <td className="py-2 pr-3">{record.summary}</td>
                      <td className="py-2">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                          {record.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
