import React, { useMemo, useState } from 'react';

export interface FollowUpInstruction {
  id: string;
  title: string;
  instructions?: string;
  dueDate?: string | null;
}

export interface FollowUpTaskListProps {
  instructions: FollowUpInstruction[];
  /** Backend-owned consent/authorization decision. Frontend never decides this. */
  canCreateReminders?: boolean;
  deniedReason?: string;
  onCreateReminders?: (selectedIds: string[]) => void | Promise<void>;
}

function formatDueDate(dueDate?: string | null): string {
  if (!dueDate) {
    return 'No date provided';
  }
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'Invalid date';
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function FollowUpTaskList({
  instructions,
  canCreateReminders = false,
  deniedReason,
  onCreateReminders,
}: FollowUpTaskListProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
    setConfirmed(false);
  };

  const handleCreate = async () => {
    if (!confirmed || selectedIds.length === 0 || !onCreateReminders) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreateReminders(selectedIds);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create reminders.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreateReminders) {
    return (
      <section aria-labelledby="follow-up-heading">
        <h2 id="follow-up-heading">Follow-up tasks</h2>
        <p role="status">
          {deniedReason ??
            'Reminders are unavailable. Consent or authorization is required.'}
        </p>
      </section>
    );
  }

  if (instructions.length === 0) {
    return (
      <section aria-labelledby="follow-up-heading">
        <h2 id="follow-up-heading">Follow-up tasks</h2>
        <p role="status">No follow-up instructions were provided.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="follow-up-heading">
      <h2 id="follow-up-heading">Follow-up tasks</h2>
      <p>Review the follow-up instructions below before creating reminders.</p>
      <ul>
        {instructions.map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(selected[item.id])}
                onChange={() => toggle(item.id)}
                aria-describedby={`follow-up-desc-${item.id}`}
              />
              <span>{item.title}</span>
            </label>
            <p id={`follow-up-desc-${item.id}`}>
              {item.instructions ? `${item.instructions} — ` : ''}
              Due: {formatDueDate(item.dueDate)}
            </p>
          </li>
        ))}
      </ul>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          I confirm I want to create notifications and calendar events for the
          selected follow-up tasks.
        </span>
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button
        type="button"
        onClick={handleCreate}
        disabled={!confirmed || selectedIds.length === 0 || submitting}
      >
        {submitting ? 'Creating reminders…' : 'Create reminders'}
      </button>
    </section>
  );
}

export default FollowUpTaskList;
