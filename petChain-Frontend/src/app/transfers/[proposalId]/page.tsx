'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// Server is the source of truth for proposal state. The client only renders
// what the backend reports; authorization and consent decisions stay server-side.
type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

interface TransferStep {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
  responsibleParty?: string;
  isNextAction?: boolean;
}

interface TransferProposal {
  proposalId: string;
  petName?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  steps: TransferStep[];
  nextActionParty?: string;
  nextActionLabel?: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; proposal: TransferProposal }
  | { kind: 'empty' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  failed: 'Failed',
  skipped: 'Skipped',
};

function statusBadgeClass(status: StepStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'skipped':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

export default function TransferProgressPage() {
  const params = useParams<{ proposalId: string }>();
  const proposalId = params?.proposalId;
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (!proposalId) {
      setState({ kind: 'empty' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const res = await fetch(
        `/api/transfers/${encodeURIComponent(proposalId)}`,
        { credentials: 'same-origin', headers: { Accept: 'application/json' } },
      );
      if (res.status === 401 || res.status === 403) {
        setState({ kind: 'denied' });
        return;
      }
      if (res.status === 404) {
        setState({ kind: 'empty' });
        return;
      }
      if (!res.ok) {
        setState({ kind: 'error', message: 'Unable to load transfer progress.' });
        return;
      }
      const proposal = (await res.json()) as TransferProposal;
      if (!proposal || !Array.isArray(proposal.steps) || proposal.steps.length === 0) {
        setState({ kind: 'empty' });
        return;
      }
      setState({ kind: 'ready', proposal });
    } catch {
      setState({ kind: 'error', message: 'Unable to load transfer progress.' });
    }
  }, [proposalId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8" aria-labelledby="transfer-progress-heading">
      <h1 id="transfer-progress-heading" className="text-2xl font-semibold">
        Pet ownership transfer progress
      </h1>

      {state.kind === 'loading' && (
        <p role="status" aria-live="polite" className="mt-4 text-gray-600">
          Loading transfer progress…
        </p>
      )}

      {state.kind === 'empty' && (
        <p role="status" className="mt-4 text-gray-600">
          No transfer proposal was found for this link.
        </p>
      )}

      {state.kind === 'denied' && (
        <p role="alert" className="mt-4 text-red-700">
          You do not have access to this transfer proposal.
        </p>
      )}

      {state.kind === 'error' && (
        <div role="alert" className="mt-4 text-red-700">
          <p>{state.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded border border-red-300 px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Retry
          </button>
        </div>
      )}

      {state.kind === 'ready' && (
        <section aria-label="Transfer steps" className="mt-6">
          {state.proposal.petName && (
            <p className="text-gray-700">
              Transfer for <strong>{state.proposal.petName}</strong>
            </p>
          )}

          {state.proposal.nextActionParty && (
            <p className="mt-2 rounded bg-blue-50 px-3 py-2 text-blue-900" role="status">
              Next action: {state.proposal.nextActionLabel ?? 'awaiting action'} —
              responsible party: <strong>{state.proposal.nextActionParty}</strong>
            </p>
          )}

          <ol className="mt-4 space-y-3">
            {state.proposal.steps.map((step) => (
              <li
                key={step.id}
                className="rounded border border-gray-200 p-3"
                aria-current={step.isNextAction ? 'step' : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{step.label}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(step.status)}`}
                  >
                    {STATUS_LABEL[step.status]}
                  </span>
                </div>
                {step.description && (
                  <p className="mt-1 text-sm text-gray-600">{step.description}</p>
                )}
                {step.responsibleParty && (
                  <p className="mt-1 text-sm text-gray-700">
                    Responsible: {step.responsibleParty}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
