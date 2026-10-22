import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { getLabResults } from '@/lib/api/labResultsAPI';
import type { LabResultItem } from '@/types/lab-results';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function valueWithUnit(item: LabResultItem): string {
  const unit = item.referenceRange?.unit?.trim();
  return `${item.value}${unit ? ` ${unit}` : ''}`;
}

export default function HealthScoreExplanation({ petId }: { petId: string }) {
  const [results, setResults] = useState<LabResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLabResults(petId)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Unable to load measured inputs.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [petId]);

  const { factors, firstDate, lastDate } = useMemo(() => {
    const groups = new Map<string, LabResultItem[]>();
    results.forEach((item) => {
      const current = groups.get(item.testName) ?? [];
      current.push(item);
      groups.set(item.testName, current);
    });
    const entries = Array.from(groups.entries()).map(([testName, items]) => {
      const ordered = [...items].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const previous = ordered.length > 1 ? ordered[ordered.length - 2] : undefined;
      const latest = ordered[ordered.length - 1];
      const sameUnit =
        previous &&
        (previous.referenceRange?.unit?.trim() || '') ===
          (latest.referenceRange?.unit?.trim() || '');
      return {
        testName,
        previous,
        latest,
        comparable: Boolean(previous && sameUnit),
      };
    });
    const dates = results
      .map((item) => new Date(item.date))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return {
      factors: entries,
      firstDate: dates[0]?.toISOString(),
      lastDate: dates[dates.length - 1]?.toISOString(),
    };
  }, [results]);

  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm" aria-labelledby="health-score-explanation-title">
      <h2 id="health-score-explanation-title" className="text-lg font-semibold text-gray-900">
        Health-score change details
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Measured inputs available from {firstDate ? formatDate(firstDate) : 'the selected period'} to{' '}
        {lastDate ? formatDate(lastDate) : 'now'}.
      </p>
      <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        A score history and its scoring window are not currently provided by the health API. The
        measurements below are shown as evidence only and are not presented as a score or cause.
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-gray-600" role="status">Loading measured inputs…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>
      ) : factors.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          Missing data: no lab measurements are available for this pet yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {factors.map(({ testName, previous, latest, comparable }) => (
            <li key={testName} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-gray-900">{testName}</h3>
                  {comparable && previous ? (
                    <p className="mt-1 text-sm text-gray-700">
                      {valueWithUnit(previous)} ({formatDate(previous.date)}) → {valueWithUnit(latest)} (
                      {formatDate(latest.date)})
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-amber-800">
                      {previous
                        ? 'Missing comparable unit data; no change is calculated.'
                        : 'Missing baseline measurement; only the latest value is available.'}{' '}
                      Latest: {valueWithUnit(latest)} ({formatDate(latest.date)}).
                    </p>
                  )}
                  {latest.sourceLab && (
                    <p className="mt-1 text-xs text-gray-500">Reported by {latest.sourceLab}</p>
                  )}
                </div>
                <Link
                  href={`/lab-results?petId=${encodeURIComponent(petId)}&test=${encodeURIComponent(testName)}`}
                  className="shrink-0 text-sm font-medium text-blue-700 underline"
                >
                  View source results
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
