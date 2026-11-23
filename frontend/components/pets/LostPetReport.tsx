'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';

/**
 * Lost-pet report flow for the emergency scan page.
 *
 * The owner can mark a pet missing, review the public details that will be
 * shown on the emergency scan page, and close the alert after recovery.
 * Authorization and consent decisions are owned by the backend: this
 * component only surfaces the server's response and never decides on its own
 * whether a report may be created or closed.
 */

export interface LostPetPublicDetails {
  petName: string;
  species?: string;
  breed?: string;
  color?: string;
  lastSeenLocation?: string;
  contactInstructions?: string;
  photoUrl?: string;
}

export interface LostPetReportState {
  status: 'active' | 'closed';
  reportedAt?: string;
  publicDetails: LostPetPublicDetails;
}

export interface LostPetReportProps {
  petId: string;
  /** Current report state from the backend, or null when no report exists. */
  report: LostPetReportState | null;
  /** Whether the backend allows this owner to manage a lost-pet report. */
  canManage?: boolean;
  /** Reason the backend denied access, shown when canManage is false. */
  deniedReason?: string;
  /** Called when the owner confirms marking the pet missing. */
  onReportMissing?: (petId: string) => Promise<void> | void;
  /** Called when the owner confirms closing the alert after recovery. */
  onCloseReport?: (petId: string) => Promise<void> | void;
}

function formatReportedAt(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export default function LostPetReport({
  petId,
  report,
  canManage = true,
  deniedReason,
  onReportMissing,
  onCloseReport,
}: LostPetReportProps) {
  const headingId = useId();
  const detailsId = useId();
  const [confirming, setConfirming] = useState<'report' | 'close' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirming(null);
    setError(null);
  }, [petId, report?.status]);

  const isActive = report?.status === 'active';
  const reportedAt = useMemo(
    () => formatReportedAt(report?.reportedAt),
    [report?.reportedAt],
  );

  const runAction = useCallback(
    async (action: 'report' | 'close') => {
      const handler = action === 'report' ? onReportMissing : onCloseReport;
      if (!handler) return;
      setPending(true);
      setError(null);
      try {
        await handler(petId);
        setConfirming(null);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Something went wrong. Please try again.',
        );
      } finally {
        setPending(false);
      }
    },
    [onCloseReport, onReportMissing, petId],
  );

  if (!canManage) {
    return (
      <section aria-labelledby={headingId} className="rounded-lg border border-gray-200 p-4">
        <h2 id={headingId} className="text-lg font-semibold">
          Lost-pet report
        </h2>
        <p role="status" className="mt-2 text-sm text-gray-600">
          {deniedReason ||
            'You do not have permission to manage a lost-pet report for this pet.'}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-gray-200 p-4">
      <h2 id={headingId} className="text-lg font-semibold">
        Lost-pet report
      </h2>

      {isActive ? (
        <p role="status" className="mt-2 text-sm text-amber-700">
          This pet is marked missing.
          {reportedAt ? ` Reported ${reportedAt}.` : ''}
        </p>
      ) : (
        <p className="mt-2 text-sm text-gray-600">
          Mark this pet missing to show recovery details on the emergency scan
          page.
        </p>
      )}

      <div className="mt-4">
        <h3 id={detailsId} className="text-sm font-medium">
          Public details shown on the emergency scan page
        </h3>
        <dl
          aria-labelledby={detailsId}
          className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2"
        >
          <Detail label="Name" value={report?.publicDetails.petName} />
          <Detail label="Species" value={report?.publicDetails.species} />
          <Detail label="Breed" value={report?.publicDetails.breed} />
          <Detail label="Color" value={report?.publicDetails.color} />
          <Detail
            label="Last seen"
            value={report?.publicDetails.lastSeenLocation}
          />
          <Detail
            label="Contact instructions"
            value={report?.publicDetails.contactInstructions}
          />
        </dl>
        {report?.publicDetails.photoUrl ? (
          <img
            src={report.publicDetails.photoUrl}
            alt={`Photo of ${report.publicDetails.petName}`}
            className="mt-3 h-32 w-32 rounded object-cover"
          />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {isActive ? (
          confirming === 'close' ? (
            <>
              <button
                type="button"
                onClick={() => runAction('close')}
                disabled={pending}
                className="rounded bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? 'Closing…' : 'Confirm recovered'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={pending}
                className="rounded border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming('close')}
              className="rounded border border-gray-300 px-3 py-2 text-sm font-medium"
            >
              Mark as recovered
            </button>
          )
        ) : confirming === 'report' ? (
          <>
            <button
              type="button"
              onClick={() => runAction('report')}
              disabled={pending}
              className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? 'Reporting…' : 'Confirm missing'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              disabled={pending}
              className="rounded border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming('report')}
            className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white"
          >
            Mark pet as missing
          </button>
        )}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="font-medium text-gray-700">{label}</dt>
      <dd className="text-gray-900">{value || 'Not provided'}</dd>
    </div>
  );
}
