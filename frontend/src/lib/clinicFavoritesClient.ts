export type ClinicFavorite = {
  clinicId: string;
  favorited: boolean;
  updatedAt: string;
};

export type FavoriteMutation = {
  clinicId: string;
  favorited: boolean;
  updatedAt: string;
};

export type SyncResult = {
  favorites: ClinicFavorite[];
  conflicts: ClinicFavorite[];
};

export type ClinicFavoritesClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  storageKey?: string;
};

const DEFAULT_STORAGE_KEY = "petchain.clinicFavorites.v1";

function isFavorite(value: unknown): value is ClinicFavorite {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.clinicId === "string" &&
    typeof candidate.favorited === "boolean" &&
    typeof candidate.updatedAt === "string"
  );
}

function parseFavorites(raw: string | null): ClinicFavorite[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFavorite);
  } catch {
    return [];
  }
}

/**
 * Deterministic conflict resolution: the most recent `updatedAt` wins.
 * When timestamps tie, the favorited=true state wins so a favorite is never
 * silently dropped; if both agree on favorited, the incoming value is kept.
 */
export function resolveFavoriteConflict(
  local: ClinicFavorite,
  remote: ClinicFavorite,
): ClinicFavorite {
  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);
  if (localTime !== remoteTime) {
    return localTime > remoteTime ? local : remote;
  }
  if (local.favorited !== remote.favorited) {
    return local.favorited ? local : remote;
  }
  return remote;
}

function mergeFavorites(
  local: ClinicFavorite[],
  remote: ClinicFavorite[],
): { merged: ClinicFavorite[]; conflicts: ClinicFavorite[] } {
  const byId = new Map<string, ClinicFavorite>();
  for (const favorite of remote) byId.set(favorite.clinicId, favorite);

  const conflicts: ClinicFavorite[] = [];
  for (const favorite of local) {
    const existing = byId.get(favorite.clinicId);
    if (!existing) {
      byId.set(favorite.clinicId, favorite);
      continue;
    }
    if (existing.favorited === favorite.favorited) {
      byId.set(favorite.clinicId, resolveFavoriteConflict(favorite, existing));
      continue;
    }
    const winner = resolveFavoriteConflict(favorite, existing);
    conflicts.push(winner);
    byId.set(favorite.clinicId, winner);
  }

  return {
    merged: Array.from(byId.values()).sort((a, b) =>
      a.clinicId.localeCompare(b.clinicId),
    ),
    conflicts,
  };
}

export class ClinicFavoritesClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  private readonly storageKey: string;

  constructor(options: ClinicFavoritesClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "/api";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.storage =
      options.storage ??
      (typeof window !== "undefined" ? window.localStorage : undefined);
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  }

  getLocalFavorites(): ClinicFavorite[] {
    if (!this.storage) return [];
    return parseFavorites(this.storage.getItem(this.storageKey));
  }

  private persist(favorites: ClinicFavorite[]): void {
    if (!this.storage) return;
    this.storage.setItem(this.storageKey, JSON.stringify(favorites));
  }

  /**
   * Records a favorite change locally first so it survives offline, then
   * attempts to sync. Authorization and consent are decided by the backend;
   * a 401/403 response is surfaced to the caller without mutating local state.
   */
  async setFavorite(
    clinicId: string,
    favorited: boolean,
    now: () => string = () => new Date().toISOString(),
  ): Promise<ClinicFavorite> {
    const mutation: ClinicFavorite = {
      clinicId,
      favorited,
      updatedAt: now(),
    };

    const local = this.getLocalFavorites().filter(
      (favorite) => favorite.clinicId !== clinicId,
    );
    local.push(mutation);
    this.persist(local);

    try {
      await this.push([mutation]);
    } catch (error) {
      if (error instanceof FavoriteAuthError) throw error;
      // Offline or transient failure: keep the local change for later sync.
    }

    return mutation;
  }

  private async push(mutations: FavoriteMutation[]): Promise<void> {
    if (mutations.length === 0) return;
    const response = await this.fetchImpl(`${this.baseUrl}/clinics/favorites`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ favorites: mutations }),
    });
    if (response.status === 401 || response.status === 403) {
      throw new FavoriteAuthError(response.status);
    }
    if (!response.ok) {
      throw new Error(`Favorite sync failed with status ${response.status}`);
    }
  }

  /**
   * Pulls server favorites, merges with any pending local changes using
   * deterministic conflict resolution, and pushes the resolved state back.
   */
  async sync(): Promise<SyncResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/clinics/favorites`, {
      method: "GET",
      credentials: "include",
    });
    if (response.status === 401 || response.status === 403) {
      throw new FavoriteAuthError(response.status);
    }
    if (!response.ok) {
      throw new Error(`Favorite sync failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { favorites?: unknown };
    const remote = Array.isArray(payload.favorites)
      ? payload.favorites.filter(isFavorite)
      : [];

    const { merged, conflicts } = mergeFavorites(
      this.getLocalFavorites(),
      remote,
    );
    this.persist(merged);

    if (conflicts.length > 0) {
      await this.push(conflicts);
    }

    return { favorites: merged, conflicts };
  }
}

export class FavoriteAuthError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Clinic favorites request was denied (status ${status})`);
    this.name = "FavoriteAuthError";
    this.status = status;
  }
}
