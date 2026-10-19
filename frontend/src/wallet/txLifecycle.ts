/**
 * Stellar wallet transaction lifecycle state machine.
 *
 * Models pending → submitted → {confirmed|failed|replaced|cancelled|unknown}
 * so the UI never mistakes a replacement/cancellation for a second user action,
 * and so polling stops once a terminal state is reached.
 */

export type TxLifecycleState =
  | "pending"
  | "submitted"
  | "confirmed"
  | "failed"
  | "replaced"
  | "cancelled"
  | "unknown";

export const TERMINAL_STATES: ReadonlySet<TxLifecycleState> = new Set([
  "confirmed",
  "failed",
  "replaced",
  "cancelled",
]);

export interface TxHistoryEntry {
  hash: string;
  state: TxLifecycleState;
  at: string; // ISO-8601
  note?: string;
}

export interface TxTracker {
  /** Original hash the user first submitted. */
  originalHash: string;
  /** Hash that should be linked in the UI (final or latest). */
  displayHash: string;
  state: TxLifecycleState;
  history: TxHistoryEntry[];
  /** When set, a replacement was submitted for the prior hash. */
  replacesHash?: string;
  /** When set, this hash was cancelled / rolled back by the wallet. */
  cancelledByHash?: string;
}

export function isTerminal(state: TxLifecycleState): boolean {
  return TERMINAL_STATES.has(state);
}

export function createTracker(originalHash: string, at = new Date().toISOString()): TxTracker {
  if (!originalHash || typeof originalHash !== "string") {
    throw new Error("originalHash is required");
  }
  return {
    originalHash,
    displayHash: originalHash,
    state: "pending",
    history: [{ hash: originalHash, state: "pending", at }],
  };
}

export function transition(
  tracker: TxTracker,
  next: TxLifecycleState,
  opts: { hash?: string; at?: string; note?: string; replacesHash?: string } = {},
): TxTracker {
  if (isTerminal(tracker.state) && next !== tracker.state) {
    // Terminal states are sticky — ignore late polls except identical confirm.
    return tracker;
  }

  const hash = opts.hash ?? tracker.displayHash;
  const at = opts.at ?? new Date().toISOString();

  const history = [
    ...tracker.history,
    { hash, state: next, at, ...(opts.note ? { note: opts.note } : {}) },
  ];

  const replacesHash =
    next === "replaced" ? opts.replacesHash ?? tracker.displayHash : tracker.replacesHash;

  return {
    ...tracker,
    state: next,
    displayHash: hash,
    history,
    replacesHash,
    cancelledByHash: next === "cancelled" ? hash : tracker.cancelledByHash,
  };
}

/** Apply a Horizon/Soroban status poll result. */
export function applyPollResult(
  tracker: TxTracker,
  result: {
    status: "success" | "failed" | "pending" | "not_found" | "timeout" | "network_error";
    hash?: string;
  },
): TxTracker {
  if (isTerminal(tracker.state)) return tracker;

  switch (result.status) {
    case "success":
      return transition(tracker, "confirmed", { hash: result.hash });
    case "failed":
      return transition(tracker, "failed", { hash: result.hash });
    case "pending":
      return tracker.state === "pending"
        ? transition(tracker, "submitted", { hash: result.hash })
        : tracker;
    case "not_found":
    case "timeout":
    case "network_error":
      return tracker.state === "pending" || tracker.state === "submitted"
        ? tracker
        : transition(tracker, "unknown", {
            hash: result.hash,
            note: result.status,
          });
    default:
      return transition(tracker, "unknown", { note: "unrecognized poll status" });
  }
}

/** Record that the wallet replaced the in-flight tx with a new hash. */
export function markReplaced(
  tracker: TxTracker,
  newHash: string,
  at = new Date().toISOString(),
): TxTracker {
  if (isTerminal(tracker.state) && tracker.state !== "submitted" && tracker.state !== "pending") {
    return tracker;
  }
  const withOld = transition(tracker, "replaced", {
    hash: tracker.displayHash,
    replacesHash: tracker.displayHash,
    at,
    note: "superseded by replacement",
  });
  // Start tracking the replacement as a fresh submitted tx, preserving history.
  return {
    ...withOld,
    state: "submitted",
    displayHash: newHash,
    replacesHash: tracker.displayHash,
    history: [
      ...withOld.history,
      { hash: newHash, state: "submitted", at, note: "replacement submitted" },
    ],
  };
}

/** Record an explicit user/wallet cancellation of the pending tx. */
export function markCancelled(
  tracker: TxTracker,
  at = new Date().toISOString(),
): TxTracker {
  if (isTerminal(tracker.state)) return tracker;
  return transition(tracker, "cancelled", {
    hash: tracker.displayHash,
    at,
    note: "cancelled by user/wallet",
  });
}

/** Persist/restore helpers for reload-safe polling. */
export function serializeTracker(tracker: TxTracker): string {
  return JSON.stringify(tracker);
}

export function deserializeTracker(raw: string): TxTracker {
  const parsed = JSON.parse(raw) as TxTracker;
  if (!parsed?.originalHash || !parsed?.state || !Array.isArray(parsed.history)) {
    throw new Error("invalid tracker payload");
  }
  return parsed;
}

export function shouldPoll(tracker: TxTracker): boolean {
  return !isTerminal(tracker.state);
}
