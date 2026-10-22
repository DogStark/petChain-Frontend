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
  status: TransferStepStatus;
  /** Party responsible for the next action on this step, if any. */
  responsibleParty?: TransferParty;
  /** Optional human-readable hint for the responsible party. */
  actionHint?: string;
}

export interface TransferProposal {
  id: string;
  petId: string;
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled' | 'denied';
  steps: TransferStep[];
  /** Party responsible for the next action across the whole proposal. */
  nextActionParty?: TransferParty;
  /** Server-provided reason when the proposal is denied or blocked. */
  denialReason?: string;
  updatedAt?: string;
}

export interface UseTransferProposalResult {
  proposal: TransferProposal | null;
  steps: TransferStep[];
  nextActionParty: TransferParty | null;
  isLoading: boolean;
  error: string | null;
  /** True when the server reports no active proposal for the pet. */
  isEmpty: boolean;
  /** True when the server denies access to the proposal. */
  isDenied: boolean;
  denialReason: string | null;
  refresh: () => void;
}

interface UseTransferProposalOptions {
  petId: string | null | undefined;
  /** Injectable fetch for tests; defaults to global fetch. */
  fetcher?: typeof fetch;
  /** Base path for the proposal endpoint. */
  endpoint?: (petId: string) => string;
}

const defaultEndpoint = (petId: string) =>
  `/api/pets/${encodeURIComponent(petId)}/transfer-proposal`;

/**
 * Loads the current pet ownership transfer proposal from the server.
 *
 * The server is the source of truth: the hook never derives step status or
 * the responsible party locally, it only surfaces what the backend returns so
 * the page can recover from the server's current proposal state.
 */
export function useTransferProposal({
  petId,
  fetcher,
  endpoint = defaultEndpoint,
}: UseTransferProposalOptions): UseTransferProposalResult {
  const [proposal, setProposal] = useState<TransferProposal | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(petId));
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState<boolean>(false);
  const [isDenied, setIsDenied] = useState<boolean>(false);
  const [denialReason, setDenialReason] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!petId) {
      setProposal(null);
      setIsLoading(false);
      setError(null);
      setIsEmpty(true);
      setIsDenied(false);
      setDenialReason(null);
      return;
    }

    const doFetch = fetcher ?? (typeof fetch !== 'undefined' ? fetch : undefined);
    if (!doFetch) {
      setError('Unable to load transfer proposal.');
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let active = true;
    setIsLoading(true);
    setError(null);

    doFetch(endpoint(petId), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!active) return;

        if (response.status === 401 || response.status === 403) {
          const body = await safeJson(response);
          setIsDenied(true);
          setDenialReason(
            typeof body?.reason === 'string'
              ? body.reason
              : 'You do not have access to this transfer proposal.',
          );
          setProposal(null);
          setIsEmpty(false);
          return;
        }

        if (response.status === 404) {
          setProposal(null);
          setIsEmpty(true);
          setIsDenied(false);
          setDenialReason(null);
          return;
        }

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const body = await safeJson(response);
        const next = normalizeProposal(body);
        if (!next) {
          setProposal(null);
          setIsEmpty(true);
          setIsDenied(false);
          setDenialReason(null);
          return;
        }

        setProposal(next);
        setIsEmpty(false);
        setIsDenied(next.status === 'denied');
        setDenialReason(next.denialReason ?? null);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unable to load transfer proposal.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [petId, fetcher, endpoint, reloadToken]);

  const steps = useMemo(() => proposal?.steps ?? [], [proposal]);

  const nextActionParty = useMemo<TransferParty | null>(() => {
    if (!proposal) return null;
    if (proposal.nextActionParty) return proposal.nextActionParty;
    const pending = proposal.steps.find(
      (step) => step.status !== 'completed' && step.status !== 'cancelled',
    );
    return pending?.responsibleParty ?? null;
  }, [proposal]);

  return {
    proposal,
    steps,
    nextActionParty,
    isLoading,
    error,
    isEmpty,
    isDenied,
    denialReason,
    refresh,
  };
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeProposal(body: any): TransferProposal | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body.proposal ?? body;
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;

  const steps: TransferStep[] = Array.isArray(raw.steps)
    ? raw.steps
        .filter((step: any) => step && typeof step.id === 'string')
        .map((step: any) => ({
          id: step.id,
          label: typeof step.label === 'string' ? step.label : step.id,
          status: normalizeStatus(step.status),
          responsibleParty: normalizeParty(step.responsibleParty),
          actionHint: typeof step.actionHint === 'string' ? step.actionHint : undefined,
        }))
    : [];

  return {
    id: raw.id,
    petId: typeof raw.petId === 'string' ? raw.petId : '',
    status: normalizeProposalStatus(raw.status),
    steps,
    nextActionParty: normalizeParty(raw.nextActionParty),
    denialReason: typeof raw.denialReason === 'string' ? raw.denialReason : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

function normalizeStatus(value: unknown): TransferStepStatus {
  switch (value) {
    case 'pending':
    case 'in_progress':
    case 'awaiting_signature':
    case 'completed':
    case 'failed':
    case 'cancelled':
      return value;
    default:
      return 'pending';
  }
}

function normalizeProposalStatus(value: unknown): TransferProposal['status'] {
  switch (value) {
    case 'draft':
    case 'in_progress':
    case 'completed':
    case 'cancelled':
    case 'denied':
      return value;
    default:
      return 'in_progress';
  }
}

function normalizeParty(value: unknown): TransferParty | undefined {
  switch (value) {
    case 'owner':
    case 'recipient':
    case 'vet':
    case 'multisig':
    case 'system':
      return value;
    default:
      return undefined;
  }
}
