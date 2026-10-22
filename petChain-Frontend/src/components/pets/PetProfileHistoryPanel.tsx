import React, { useCallback, useEffect, useMemo, useState } from 'react';

export interface PetProfileHistoryEntry {
  id: string;
  field: string;
  previousValue?: string | null;
  newValue?: string | null;
  actor: string;
  timestamp: string;
  source?: 'manual' | 'import' | 'system';
  isSecret?: boolean;
}

export interface PetProfileHistoryPanelProps {
  petId: string;
  fetchHistory: (petId: string) => Promise<PetProfileHistoryEntry[]>;
  requestCorrection?: (entryId: string, petId: string) => Promise<void>;
}

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const displayValue = (entry: PetProfileHistoryEntry, value?: string | null): string => {
  if (entry.isSecret) {
    return '••••••';
  }
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return value;
};

export const PetProfileHistoryPanel: React.FC<PetProfileHistoryPanelProps> = ({
  petId,
  fetchHistory,
  requestCorrection,
}) => {
  const [entries, setEntries] = useState<PetProfileHistoryEntry[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'denied' | 'error'>('idle');
  const [correctionState, setCorrectionState] = useState<Record<string, 'pending' | 'sent' | 'failed'>>({});

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchHistory(petId)
      .then((result) => {
        if (cancelled) return;
        setEntries(result);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus(/forbidden|denied|unauthor/i.test(message) ? 'denied' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [petId, fetchHistory]);

  const handleCorrection = useCallback(
    async (entryId: string) => {
      if (!requestCorrection) return;
      setCorrectionState((prev) => ({ ...prev, [entryId]: 'pending' }));
      try {
        await requestCorrection(entryId, petId);
        setCorrectionState((prev) => ({ ...prev, [entryId]: 'sent' }));
      } catch {
        setCorrectionState((prev) => ({ ...prev, [entryId]: 'failed' }));
      }
    },
    [petId, requestCorrection],
  );

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [entries],
  );

  return (
    <section aria-labelledby="pet-profile-history-heading" className="pet-profile-history">
      <h2 id="pet-profile-history-heading">Profile change history</h2>

      {status === 'loading' && <p role="status">Loading change history…</p>}

      {status === 'denied' && (
        <p role="alert">You do not have permission to view this pet’s change history.</p>
      )}

      {status === 'error' && (
        <p role="alert">Unable to load the change history. Please try again later.</p>
      )}

      {status === 'ready' && sortedEntries.length === 0 && (
        <p>No profile changes have been recorded yet.</p>
      )}

      {status === 'ready' && sortedEntries.length > 0 && (
        <ol className="pet-profile-history__list">
          {sortedEntries.map((entry) => {
            const correction = correctionState[entry.id];
            const canRequestCorrection = entry.source === 'import' && Boolean(requestCorrection);
            return (
              <li key={entry.id} className="pet-profile-history__item">
                <p className="pet-profile-history__field">
                  <strong>{entry.field}</strong>
                </p>
                <p className="pet-profile-history__values">
                  <span aria-label="Previous value">{displayValue(entry, entry.previousValue)}</span>
                  {' → '}
                  <span aria-label="New value">{displayValue(entry, entry.newValue)}</span>
                </p>
                <p className="pet-profile-history__meta">
                  Changed by {entry.actor} on{' '}
                  <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
                </p>
                {canRequestCorrection && (
                  <div className="pet-profile-history__correction">
                    <button
                      type="button"
                      onClick={() => handleCorrection(entry.id)}
                      disabled={correction === 'pending' || correction === 'sent'}
                      aria-describedby={`correction-status-${entry.id}`}
                    >
                      {correction === 'sent' ? 'Correction requested' : 'Request correction'}
                    </button>
                    <span id={`correction-status-${entry.id}`} role="status">
                      {correction === 'pending' && 'Submitting correction request…'}
                      {correction === 'sent' && 'Your correction request has been submitted.'}
                      {correction === 'failed' && 'Could not submit correction request. Please try again.'}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default PetProfileHistoryPanel;
