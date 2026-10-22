'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

type AmendmentField = {
  field: string;
  label: string;
  original: string | null;
  corrected: string | null;
};

type Amendment = {
  id: string;
  author: string;
  createdAt: string;
  reason?: string | null;
  fields: AmendmentField[];
};

type AmendmentsResponse = {
  recordId: string;
  amendments: Amendment[];
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: AmendmentsResponse }
  | { status: 'empty' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

function formatValue(value: string | null): string {
  if (value === null || value === '') {
    return '—';
  }
  return value;
}

function isChanged(field: AmendmentField): boolean {
  return field.original !== field.corrected;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function MedicalRecordAmendmentsPage() {
  const params = useParams<{ id: string }>();
  const recordId = params?.id;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!recordId) {
      setState({ status: 'error', message: 'Missing medical record id.' });
      return;
    }

    setState({ status: 'loading' });
    try {
      const response = await fetch(
        `/api/medical-records/${encodeURIComponent(recordId)}/amendments`,
        { headers: { Accept: 'application/json' }, credentials: 'same-origin' },
      );

      if (response.status === 401 || response.status === 403) {
        setState({ status: 'denied' });
        return;
      }

      if (!response.ok) {
        setState({
          status: 'error',
          message: 'Unable to load amendment history. Please try again.',
        });
        return;
      }

      const data = (await response.json()) as AmendmentsResponse;
      if (!data.amendments || data.amendments.length === 0) {
        setState({ status: 'empty' });
        return;
      }

      setState({ status: 'ready', data });
    } catch {
      setState({
        status: 'error',
        message: 'Unable to load amendment history. Please try again.',
      });
    }
  }, [recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const amendments = useMemo(
    () => (state.status === 'ready' ? state.data.amendments : []),
    [state],
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Medical record amendments
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Compare the original record against each correction. Changed values are
          highlighted, and the prior version and author are kept in the history.
        </p>
      </header>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite" className="text-sm text-slate-600">
          Loading amendment history…
        </p>
      )}

      {state.status === 'denied' && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          You do not have access to this record’s amendment history.
        </div>
      )}

      {state.status === 'error' && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p>{state.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-md border border-red-400 px-3 py-1 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === 'empty' && (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No amendments have been recorded for this medical record.
        </p>
      )}

      {state.status === 'ready' && (
        <ol className="space-y-8">
          {amendments.map((amendment) => (
            <li key={amendment.id}>
              <section
                aria-labelledby={`amendment-${amendment.id}-heading`}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2
                    id={`amendment-${amendment.id}-heading`}
                    className="text-lg font-medium text-slate-900"
                  >
                    Amendment by {amendment.author}
                  </h2>
                  <time
                    dateTime={amendment.createdAt}
                    className="text-sm text-slate-500"
                  >
                    {formatTimestamp(amendment.createdAt)}
                  </time>
                </div>

                {amendment.reason ? (
                  <p className="mb-4 text-sm text-slate-700">
                    <span className="font-medium">Reason: </span>
                    {amendment.reason}
                  </p>
                ) : null}

                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Side-by-side comparison of original and corrected values for
                    amendment by {amendment.author}
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="py-2 pr-4 font-medium text-slate-700">
                        Field
                      </th>
                      <th scope="col" className="py-2 pr-4 font-medium text-slate-700">
                        Original
                      </th>
                      <th scope="col" className="py-2 font-medium text-slate-700">
                        Corrected
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {amendment.fields.map((field) => {
                      const changed = isChanged(field);
                      return (
                        <tr
                          key={field.field}
                          className="border-b border-slate-100 align-top"
                        >
                          <th
                            scope="row"
                            className="py-2 pr-4 font-normal text-slate-800"
                          >
                            {field.label}
                            {changed ? (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                                Changed
                              </span>
                            ) : null}
                          </th>
                          <td
                            className={
                              changed
                                ? 'py-2 pr-4 text-slate-500 line-through'
                                : 'py-2 pr-4 text-slate-700'
                            }
                          >
                            {formatValue(field.original)}
                          </td>
                          <td
                            className={
                              changed
                                ? 'py-2 font-medium text-slate-900 bg-amber-50'
                                : 'py-2 text-slate-700'
                            }
                          >
                            {formatValue(field.corrected)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
