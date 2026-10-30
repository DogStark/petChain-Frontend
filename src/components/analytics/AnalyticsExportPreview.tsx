import { Download, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import Dialog from '@/components/ui/Dialog';
import { useAnalyticsExportPreview } from '@/hooks/useAnalyticsExportPreview';
import type {
  AnalyticsExport,
  AnalyticsExportData} from '@/lib/analytics/exportBuilder';
import {
  downloadAnalyticsExport,
} from '@/lib/analytics/exportBuilder';

const SAMPLE_ROW_LIMIT = 3;
const TITLE_ID = 'analytics-export-preview-title';
const HELP_ID = 'include-personal-data-help';

interface AnalyticsExportPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  /** The same data the dashboard charts render — it defines the export. */
  data: AnalyticsExportData | null;
  /** Optional side-effect override (tests, storybook). Defaults to a CSV download. */
  onDownload?: (analyticsExport: AnalyticsExport) => void;
}

/**
 * Privacy-aware preview of the analytics export.
 *
 * Shows the exact fields and date range the download contains, masks
 * identifiers by default, and requires a separate, explicit opt-in before
 * personal data can be unmasked — which the backend still has to authorise.
 */
export default function AnalyticsExportPreview({
  isOpen,
  onClose,
  data,
  onDownload,
}: AnalyticsExportPreviewProps) {
  const {
    analyticsExport,
    personalDataIncluded,
    status,
    message,
    requesting,
    canDownload,
    requestPersonalData,
    excludePersonalData,
  } = useAnalyticsExportPreview(isOpen ? data : null);

  const [includeRequested, setIncludeRequested] = useState(false);

  // A fresh preview always starts masked: privacy is the default state.
  useEffect(() => {
    if (isOpen) {
      setIncludeRequested(false);
      excludePersonalData();
    }
  }, [isOpen, excludePersonalData]);

  // A denial or failure must never leave the opt-in visually switched on.
  useEffect(() => {
    if (status === 'masked' || status === 'denied' || status === 'error') {
      setIncludeRequested(false);
    }
  }, [status]);

  const handleToggle = (checkedState: boolean) => {
    setIncludeRequested(checkedState);
    if (checkedState) {
      void requestPersonalData();
    } else {
      excludePersonalData();
    }
  };

  const handleDownload = () => {
    if (!analyticsExport || !canDownload) return;
    if (onDownload) {
      onDownload(analyticsExport);
      return;
    }
    downloadAnalyticsExport(analyticsExport);
  };

  const fieldRows = useMemo(
    () =>
      (analyticsExport?.sections ?? []).flatMap((section) =>
        section.fields.map((current) => ({
          id: `${section.id}:${current.key}`,
          section: section.title,
          field: current,
        })),
      ),
    [analyticsExport],
  );

  const dateRange = analyticsExport?.dateRange ?? null;
  const isEmpty = Boolean(analyticsExport && analyticsExport.dataRowCount === 0);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} titleId={TITLE_ID} className="w-full max-w-3xl">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-xl md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={TITLE_ID} className="text-2xl font-bold text-blue-700">
              Export preview
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Review exactly what this report contains before downloading it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export preview"
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <section aria-label="Export date range" className="mt-6 rounded-2xl bg-blue-50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-800">
            Date range included
          </h3>
          <p className="mt-1 text-lg font-semibold text-gray-900" data-testid="export-date-range">
            {dateRange
              ? `${dateRange.startDate} to ${dateRange.endDate} (${dateRange.days} ${
                  dateRange.days === 1 ? 'day' : 'days'
                })`
              : 'Unavailable — this export has no dated rows.'}
          </p>
        </section>

        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800"
          data-testid="export-privacy-status"
        >
          {message ??
            (personalDataIncluded
              ? 'Personal data is included in this export.'
              : 'Identifiers are masked. Personal data is only included after you request it and the server authorises it.')}
        </div>

        <section aria-label="Include personal data" className="mt-6">
          <label
            htmlFor="include-personal-data"
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 p-4 hover:bg-gray-50"
          >
            <input
              id="include-personal-data"
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              checked={includeRequested}
              disabled={requesting}
              onChange={(event) => handleToggle(event.target.checked)}
              aria-describedby={HELP_ID}
            />
            <span>
              <span className="block font-semibold text-gray-900">
                Include personal data (unmasked identifiers)
              </span>
              <span id={HELP_ID} className="mt-1 block text-sm text-gray-600">
                A separate step from downloading. The server decides whether this account may
                export personal data; if it declines, the report stays masked.
              </span>
            </span>
          </label>
        </section>

        {!analyticsExport ? (
          <p className="mt-6 text-sm text-gray-700" data-testid="export-preview-empty">
            No analytics data is loaded, so there is nothing to preview or download.
          </p>
        ) : (
          <>
            <section aria-label="Export fields" className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Fields included ({fieldRows.length})
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Exact fields included in this export and whether they contain personal data
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="border-b border-gray-300 px-3 py-2 font-bold">
                        Section
                      </th>
                      <th scope="col" className="border-b border-gray-300 px-3 py-2 font-bold">
                        Field
                      </th>
                      <th scope="col" className="border-b border-gray-300 px-3 py-2 font-bold">
                        Key
                      </th>
                      <th scope="col" className="border-b border-gray-300 px-3 py-2 font-bold">
                        Personal data
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldRows.map((row) => (
                      <tr key={row.id} className="odd:bg-gray-50">
                        <th scope="row" className="border-b border-gray-200 px-3 py-2 font-medium">
                          {row.section}
                        </th>
                        <td className="border-b border-gray-200 px-3 py-2">{row.field.label}</td>
                        <td className="border-b border-gray-200 px-3 py-2 font-mono text-xs">
                          {row.field.key}
                        </td>
                        <td className="border-b border-gray-200 px-3 py-2">
                          {row.field.containsPersonalData ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                              Yes — masked unless authorised
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {isEmpty ? (
              <p
                className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800"
                role="status"
                data-testid="export-preview-no-rows"
              >
                No analytics rows fall inside this date range, so the export would be empty.
              </p>
            ) : (
              <section aria-label="Sample rows" className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Sample rows {personalDataIncluded ? '' : '(identifiers masked)'}
                </h3>
                {analyticsExport.sections
                  .filter((section) => section.rows.length > 0)
                  .map((section) => {
                    const visibleRows = section.rows.slice(0, SAMPLE_ROW_LIMIT);
                    return (
                      <div key={section.id} className="mt-3 overflow-x-auto">
                        <table className="min-w-full border-collapse text-left text-sm">
                          <caption className="sr-only">
                            {section.title} — first {visibleRows.length} of {section.rows.length}{' '}
                            rows
                          </caption>
                          <thead>
                            <tr>
                              {section.fields.map((current) => (
                                <th
                                  key={current.key}
                                  scope="col"
                                  className="border-b border-gray-300 px-3 py-2 font-bold"
                                >
                                  {current.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRows.map((row, rowIndex) => (
                              <tr key={`${section.id}-row-${rowIndex}`} className="odd:bg-gray-50">
                                {section.fields.map((current) => (
                                  <td
                                    key={current.key}
                                    className="border-b border-gray-200 px-3 py-2"
                                  >
                                    {row[current.key] ?? ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="mt-1 text-xs text-gray-500">
                          Showing {visibleRows.length} of {section.rows.length}{' '}
                          {section.rows.length === 1 ? 'row' : 'rows'}.
                        </p>
                      </div>
                    );
                  })}
              </section>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!canDownload}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {personalDataIncluded ? 'Download CSV (personal data included)' : 'Download CSV'}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
