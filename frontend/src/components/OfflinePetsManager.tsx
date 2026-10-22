import { useCallback, useEffect, useMemo, useState } from 'react';

interface PetSummary {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  recordCount?: number;
}

interface OfflineEntry {
  petId: string;
  pinnedAt: string;
  estimatedBytes: number;
}

interface OfflinePetsManagerProps {
  pets: PetSummary[];
  accountId: string;
  /** Persist the pinned pet's summary + recent records for offline use. */
  onPinPet?: (pet: PetSummary) => Promise<void> | void;
  /** Remove a single pet's cached data for this account. */
  onClearPet?: (petId: string) => Promise<void> | void;
  /** Load existing offline entries for the current account. */
  loadOfflineEntries?: (accountId: string) => Promise<OfflineEntry[]> | OfflineEntry[];
}

const STORAGE_KEY_PREFIX = 'petchain.offline';
const BYTES_PER_RECORD = 2048;
const BYTES_PER_SUMMARY = 512;

function storageKey(accountId: string): string {
  return `${STORAGE_KEY_PREFIX}.${accountId}`;
}

function estimateBytes(pet: PetSummary): number {
  const records = Math.max(0, pet.recordCount ?? 0);
  return BYTES_PER_SUMMARY + records * BYTES_PER_RECORD;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readLocalEntries(accountId: string): OfflineEntry[] {
  try {
    const raw = window.localStorage.getItem(storageKey(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLocalEntries(accountId: string, entries: OfflineEntry[]): void {
  try {
    window.localStorage.setItem(storageKey(accountId), JSON.stringify(entries));
  } catch {
    // Storage may be unavailable (private mode / quota); UI state still reflects intent.
  }
}

export default function OfflinePetsManager({
  pets,
  accountId,
  onPinPet,
  onClearPet,
  loadOfflineEntries,
}: OfflinePetsManagerProps) {
  const [entries, setEntries] = useState<OfflineEntry[]>([]);
  const [busyPetId, setBusyPetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const local = readLocalEntries(accountId);
      if (loadOfflineEntries) {
        try {
          const remote = await loadOfflineEntries(accountId);
          if (!cancelled) setEntries(remote);
          return;
        } catch {
          // Fall back to locally cached entries on failure.
        }
      }
      if (!cancelled) setEntries(local);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [accountId, loadOfflineEntries]);

  const pinnedIds = useMemo(() => new Set(entries.map((e) => e.petId)), [entries]);

  const totalBytes = useMemo(
    () => entries.reduce((sum, e) => sum + e.estimatedBytes, 0),
    [entries],
  );

  const persist = useCallback(
    (next: OfflineEntry[]) => {
      setEntries(next);
      writeLocalEntries(accountId, next);
    },
    [accountId],
  );

  const handlePin = useCallback(
    async (pet: PetSummary) => {
      setError(null);
      setBusyPetId(pet.id);
      try {
        await onPinPet?.(pet);
        const next = [
          ...entries.filter((e) => e.petId !== pet.id),
          { petId: pet.id, pinnedAt: new Date().toISOString(), estimatedBytes: estimateBytes(pet) },
        ];
        persist(next);
      } catch {
        setError(`Could not make ${pet.name} available offline. Please try again.`);
      } finally {
        setBusyPetId(null);
      }
    },
    [entries, onPinPet, persist],
  );

  const handleClear = useCallback(
    async (pet: PetSummary) => {
      setError(null);
      setBusyPetId(pet.id);
      try {
        await onClearPet?.(pet.id);
        persist(entries.filter((e) => e.petId !== pet.id));
      } catch {
        setError(`Could not clear the offline cache for ${pet.name}. Please try again.`);
      } finally {
        setBusyPetId(null);
      }
    },
    [entries, onClearPet, persist],
  );

  return (
    <section aria-labelledby="offline-pets-heading" className="offline-pets-manager">
      <h2 id="offline-pets-heading">Offline availability</h2>
      <p className="offline-pets-manager__hint">
        Pin a pet to keep its summary and recent records available offline. Only this account can
        see or clear its cached data.
      </p>

      <p aria-live="polite" className="offline-pets-manager__storage">
        Estimated offline storage: <strong>{formatBytes(totalBytes)}</strong>
        {entries.length > 0 ? ` across ${entries.length} pinned pet${entries.length === 1 ? '' : 's'}` : ''}
      </p>

      {error ? (
        <p role="alert" className="offline-pets-manager__error">
          {error}
        </p>
      ) : null}

      {pets.length === 0 ? (
        <p className="offline-pets-manager__empty">No pets available to pin for offline use.</p>
      ) : (
        <ul className="offline-pets-manager__list">
          {pets.map((pet) => {
            const pinned = pinnedIds.has(pet.id);
            const busy = busyPetId === pet.id;
            const label = pinned ? `Clear offline cache for ${pet.name}` : `Make ${pet.name} available offline`;
            return (
              <li key={pet.id} className="offline-pets-manager__item">
                <span className="offline-pets-manager__name">
                  {pet.name}
                  {pet.species ? ` · ${pet.species}` : ''}
                </span>
                <span className="offline-pets-manager__cost">
                  ~{formatBytes(estimateBytes(pet))}
                </span>
                <button
                  type="button"
                  aria-pressed={pinned}
                  aria-label={label}
                  disabled={busy}
                  onClick={() => (pinned ? handleClear(pet) : handlePin(pet))}
                >
                  {busy ? 'Working…' : pinned ? 'Clear cache' : 'Pin offline'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
