export type TransferStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked';

export type TransferParty = 'owner' | 'recipient' | 'vet' | 'multisig' | 'system';

export interface TransferStep {
  id: string;
  label: string;
  status: TransferStepStatus;
  /** Party responsible for the next action on this step, if any. */
  responsibleParty?: TransferParty;
  /** Whether this step requires a multisig approval. */
  multisig?: boolean;
  /** Optional human-readable detail from the server. */
  detail?: string;
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

export interface TransferProposalResponse {
  proposal: TransferProposal | null;
}

export class TransferApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TransferApiError';
    this.status = status;
  }
}

const TRANSFERS_BASE = '/api/transfers';

async function parseError(res: Response): Promise<TransferApiError> {
  let message = `Request failed with status ${res.status}`;
  try {
    const body = await res.json();
    if (body && typeof body.message === 'string') {
      message = body.message;
    }
  } catch {
    // ignore non-JSON error bodies
  }
  return new TransferApiError(message, res.status);
}

/**
 * Fetch the current transfer proposal for a pet. The server is the source of
 * truth: the page recovers its state from this response rather than from any
 * client-side assumptions. Returns `null` when no proposal exists yet.
 */
export async function fetchTransferProposal(
  petId: string,
  signal?: AbortSignal,
): Promise<TransferProposal | null> {
  const res = await fetch(`${TRANSFERS_BASE}/pets/${encodeURIComponent(petId)}/proposal`, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw await parseError(res);
  }

  const body = (await res.json()) as TransferProposalResponse;
  return body.proposal ?? null;
}

/**
 * Determine the party responsible for the next action. Prefers the server's
 * explicit `nextActionParty`, falling back to the first actionable step.
 */
export function getNextActionParty(proposal: TransferProposal | null): TransferParty | undefined {
  if (!proposal) {
    return undefined;
  }
  if (proposal.nextActionParty) {
    return proposal.nextActionParty;
  }
  const actionable = proposal.steps.find(
    (step) => step.status === 'pending' || step.status === 'in_progress',
  );
  return actionable?.responsibleParty;
}
