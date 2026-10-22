'use client';

import { useMemo } from 'react';

export interface AmendmentField {
  key: string;
  label: string;
  original: string | null | undefined;
  corrected: string | null | undefined;
}

export interface AmendmentHistoryEntry {
  version: number;
  author: string;
  amendedAt: string;
  fields: AmendmentField[];
}

export interface AmendmentViewProps {
  history: AmendmentHistoryEntry[];
  /** Optional heading for the view. */
  title?: string;
  /** Rendered when there is no amendment history to compare. */
  emptyMessage?: string;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function isChanged(field: AmendmentField): boolean {
  return normalize(field.original) !== normalize(field.corrected);
}

function displayValue(value: string | null | undefined): string {
  const trimmed = normalize(value);
  return trimmed.length > 0 ? trimmed : '\u2014';
}

export default function AmendmentView({
  history,
  title = 'Medical record amendments',
  emptyMessage = 'No amendments have been recorded for this medical record.',
}: AmendmentViewProps) {
  const orderedHistory = useMemo(
    () => [...history].sort((a, b) => b.version - a.version),
    [history],
  );

  if (orderedHistory.length === 0) {
    return (
      <section
        aria-labelledby="amendment-view-heading"
        className="rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 id="amendment-view-heading" className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <p role="status" className="mt-2 text-sm text-gray-600">
          {emptyMessage}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="amendment-view-heading"
      className="space-y-6 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h2 id="amendment-view-heading" className="text-lg font-semibold text-gray-900">
        {title}
      </h2>

      {orderedHistory.map((entry) => {
        const changedCount = entry.fields.filter(isChanged).length;
        const headingId = `amendment-version-${entry.version}`;

        return (
          <article
            key={entry.version}
            aria-labelledby={headingId}
            className="rounded-md border border-gray-200"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
              <h3 id={headingId} className="text-sm font-semibold text-gray-900">
                Version {entry.version}
              </h3>
              <p className="text-xs text-gray-600">
                Amended by <span className="font-medium text-gray-900">{entry.author}</span>{' '}
                on{' '}
                <time dateTime={entry.amendedAt}>{entry.amendedAt}</time>
              </p>
            </header>

            <p className="px-3 pt-2 text-xs text-gray-600">
              {changedCount === 0
                ? 'No field values changed in this amendment.'
                : `${changedCount} field${changedCount === 1 ? '' : 's'} changed in this amendment.`}
            </p>

            <div className="overflow-x-auto p-3">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  Side-by-side comparison of original and corrected values for version{' '}
                  {entry.version}, amended by {entry.author}.
                </caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th scope="col" className="border-b border-gray-200 px-2 py-1">
                      Field
                    </th>
                    <th scope="col" className="border-b border-gray-200 px-2 py-1">
                      Original
                    </th>
                    <th scope="col" className="border-b border-gray-200 px-2 py-1">
                      Corrected
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entry.fields.map((field) => {
                    const changed = isChanged(field);
                    return (
                      <tr
                        key={field.key}
                        className={changed ? 'bg-amber-50' : undefined}
                      >
                        <th
                          scope="row"
                          className="border-b border-gray-100 px-2 py-1 text-left font-medium text-gray-900"
                        >
                          {field.label}
                          {changed ? (
                            <span className="ml-2 rounded bg-amber-200 px-1 text-xs font-semibold text-amber-900">
                              Changed
                            </span>
                          ) : null}
                        </th>
                        <td className="border-b border-gray-100 px-2 py-1 text-gray-700">
                          <span className={changed ? 'line-through text-gray-500' : undefined}>
                            {displayValue(field.original)}
                          </span>
                        </td>
                        <td className="border-b border-gray-100 px-2 py-1 text-gray-900">
                          <span className={changed ? 'font-semibold' : undefined}>
                            {displayValue(field.corrected)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}
    </section>
  );
}
