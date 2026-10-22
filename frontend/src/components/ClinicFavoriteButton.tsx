'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'petchain:clinic-favorites';
const SYNC_ENDPOINT = '/api/clinics/favorites';

type FavoriteMap = Record<string, boolean>;

type PendingChange = {
  clinicId: string;
  favorite: boolean;
  updatedAt: number;
};

function readLocalFavorites(): FavoriteMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FavoriteMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalFavorites(map: FavoriteMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage may be unavailable (private mode); favorites stay in memory.
  }
}

/**
 * Deterministic conflict resolution: the most recent change wins. When two
 * changes share the same timestamp, the server value wins so that all devices
 * converge on the same state.
 */
export function resolveFavoriteConflict(
  local: PendingChange,
  remote: PendingChange,
): boolean {
  if (local.updatedAt > remote.updatedAt) return local.favorite;
  if (local.updatedAt < remote.updatedAt) return remote.favorite;
  return remote.favorite;
}

export interface ClinicFavoriteButtonProps {
  clinicId: string;
  clinicName: string;
  initialFavorite?: boolean;
  disabled?: boolean;
  onSynced?: (clinicId: string, favorite: boolean) => void;
}

export default function ClinicFavoriteButton({
  clinicId,
  clinicName,
  initialFavorite = false,
  disabled = false,
  onSynced,
}: ClinicFavoriteButtonProps) {
  const [favorite, setFavorite] = useState<boolean>(initialFavorite);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const local = readLocalFavorites();
    if (typeof local[clinicId] === 'boolean') {
      setFavorite(local[clinicId]);
    }
    return () => {
      mounted.current = false;
    };
  }, [clinicId]);

  const sync = useCallback(
    async (nextFavorite: boolean) => {
      const updatedAt = Date.now();
      setPending(true);
      setError(null);
      try {
        const response = await fetch(SYNC_ENDPOINT, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ clinicId, favorite: nextFavorite, updatedAt }),
        });

        if (response.status === 401 || response.status === 403) {
          throw new Error('You do not have permission to sync favorites.');
        }
        if (!response.ok) {
          throw new Error('Could not sync favorite. It will retry when online.');
        }

        const data = (await response.json().catch(() => null)) as
          | { favorite?: boolean; updatedAt?: number }
          | null;

        let resolved = nextFavorite;
        if (data && typeof data.favorite === 'boolean') {
          resolved = resolveFavoriteConflict(
            { clinicId, favorite: nextFavorite, updatedAt },
            {
              clinicId,
              favorite: data.favorite,
              updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : updatedAt,
            },
          );
        }

        if (mounted.current) {
          setFavorite(resolved);
          const local = readLocalFavorites();
          local[clinicId] = resolved;
          writeLocalFavorites(local);
          onSynced?.(clinicId, resolved);
        }
      } catch (err) {
        if (mounted.current) {
          setError(err instanceof Error ? err.message : 'Could not sync favorite.');
        }
      } finally {
        if (mounted.current) setPending(false);
      }
    },
    [clinicId, onSynced],
  );

  const toggle = useCallback(() => {
    if (disabled || pending) return;
    const next = !favorite;
    setFavorite(next);
    const local = readLocalFavorites();
    local[clinicId] = next;
    writeLocalFavorites(local);
    void sync(next);
  }, [clinicId, disabled, favorite, pending, sync]);

  const label = favorite
    ? `Remove ${clinicName} from favorites`
    : `Add ${clinicName} to favorites`;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || pending}
        aria-pressed={favorite}
        aria-label={label}
        aria-busy={pending}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true">{favorite ? '\u2605' : '\u2606'}</span>
        <span>{favorite ? 'Favorited' : 'Favorite'}</span>
      </button>
      <span role="status" aria-live="polite" className="text-xs text-gray-500">
        {pending ? 'Syncing favorite\u2026' : ''}
      </span>
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
