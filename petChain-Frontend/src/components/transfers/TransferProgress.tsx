import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type TransferStepStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_signature'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TransferParty = 'owner' | 'recipient' | 'vet' | 'multisig' | 'system';

export interface TransferStep {
  id: string;
  label: string;
  description?: string;
  status: TransferStepStatus;
  responsibleParty: TransferParty;
  requiredSignatures?: number;
  collectedSignatures?: number;
}

export interface TransferProposal {
  id: string;
  petId: string;
  petName?: string;
  status: 'draft' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  steps: TransferStep[];
  nextActionParty?: TransferParty;
  updatedAt?: string;
}

export interface TransferProgressClient {
  getProposal(proposalId: string, signal?: AbortSignal): Promise<TransferProposal>;
}

const PARTY_LABELS: Record<TransferParty, string> = {
  owner: 'Current owner',
  recipient: 'Recipient',
  vet: 'Veterinarian',
  multisig: 'Multisig signers',
  system: 'System',
};

const STATUS_LABELS: Record<TransferStepStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  awaiting_signature: 'Awaiting signature',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function isTerminal(status: TransferStepStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function deriveNextActionParty(proposal: TransferProposal): TransferParty | undefined {
  if (proposal.nextActionParty) return proposal.nextActionParty;
  const next = proposal.steps.find((step) => !isTerminal(step.status));
  return next?.responsibleParty;
}

export interface TransferProgressProps {
  proposalId: string;
  client: TransferProgressClient;
  pollIntervalMs?: number;
}

export function TransferProgress({ proposalId, client, pollIntervalMs = 15000 }: TransferProgressProps) {
  const [proposal, setProposal] = useState<TransferProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const next = await client.getProposal(proposalId, signal);
        if (signal?.aborted) return;
        setProposal(next);
        setDenied(false);
        setError(null);
      } catch (err) {
        if (signal?.aborted) return;
        const status = (err as { status?: number } | null)?.status;
        if (status === 403 || status === 404) {
          setDenied(true);
          setProposal(null);
        } else {
          setError('We could not load the transfer progress. Please try again.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [client, proposalId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!proposal || isTerminalProposal(proposal)) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      void load(controller.signal);
    }, pollIntervalMs);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [proposal, load, pollIntervalMs]);

  const nextActionParty = useMemo(
    () => (proposal ? deriveNextActionParty(proposal) : undefined),
    [proposal],
  );

  if (loading && !proposal) {
    return (
      <section aria-busy="true" aria-live="polite">
        <p>Loading transfer progress…</p>
      </section>
    );
  }

  if (denied) {
    return (
      <section role="alert">
        <h2 ref={headingRef} tabIndex={-1}>
          Transfer progress unavailable
        </h2>
        <p>You do not have access to this transfer, or it no longer exists.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section role="alert">
        <h2 ref={headingRef} tabIndex={-1}>
          Transfer progress unavailable
        </h2>
        <p>{error}</p>
        <button type="button" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  }

  if (!proposal) {
    return (
      <section>
        <h2 ref={headingRef} tabIndex={-1}>
          Transfer progress
        </h2>
        <p>No transfer proposal found.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="transfer-progress-heading">
      <h2 id="transfer-progress-heading" ref={headingRef} tabIndex={-1}>
        Transfer progress{proposal.petName ? ` for ${proposal.petName}` : ''}
      </h2>

      <p aria-live="polite">
        {nextActionParty
          ? `Next action required by: ${PARTY_LABELS[nextActionParty]}.`
          : 'No further action is required.'}
      </p>

      <ol>
        {proposal.steps.map((step) => (
          <li key={step.id}>
            <h3>{step.label}</h3>
            {step.description ? <p>{step.description}</p> : null}
            <p>
              <span>Status: {STATUS_LABELS[step.status]}</span>
              {' · '}
              <span>Responsible: {PARTY_LABELS[step.responsibleParty]}</span>
              {typeof step.requiredSignatures === 'number' ? (
                <>
                  {' · '}
                  <span>
                    Signatures: {step.collectedSignatures ?? 0}/{step.requiredSignatures}
                  </span>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function isTerminalProposal(proposal: TransferProposal): boolean {
  return (
    proposal.status === 'completed' ||
    proposal.status === 'failed' ||
    proposal.status === 'cancelled'
  );
}

export default TransferProgress;
