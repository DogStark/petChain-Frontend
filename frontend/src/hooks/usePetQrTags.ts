'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type QrTagStatus = 'active' | 'revoked';

export interface QrTag {
  id: string;
  petId: string;
  code: string;
  status: QrTagStatus;
  issuedAt: string;
  revokedAt?: string | null;
  replacedByTagId?: string | null;
}

export interface ReplacementIssuance {
  revokedTagId: string;
  newTag: QrTag;
}

export interface UsePetQrTagsResult {
  tags: QrTag[];
  activeTags: QrTag[];
  revokedTags: QrTag[];
  isLoading: boolean;
  isIssuing: boolean;
  error: string | null;
  denied: boolean;
  reload: () => Promise<void>;
  issueReplacement: (revokedTagId: string) => Promise<ReplacementIssuance | null>;
}

interface ApiError {
  status?: number;
  message?: string;
}

async function readError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    return { status: res.status, message: body?.message ?? body?.error };
  } catch {
    return { status: res.status };
  }
}

/**
 * Loads the QR tag inventory for a pet (active + revoked) and guides
 * replacement issuance. Authorization and consent decisions are owned by
 * the backend; this hook only surfaces the resulting states.
 *
 * Revoked codes are never reactivated locally: the inventory is always
 * re-fetched with cache disabled after a replacement so a stale browser
 * cache cannot resurrect a revoked code.
 */
export function usePetQrTags(petId: string | null | undefined): UsePetQrTagsResult {
  const [tags, setTags] = useState<QrTag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(petId));
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!petId) {
      setTags([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setDenied(false);
    try {
      const res = await fetch(`/api/pets/${encodeURIComponent(petId)}/qr-tags`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401 || res.status === 403) {
        if (mountedRef.current) {
          setDenied(true);
          setTags([]);
        }
        return;
      }
      if (!res.ok) {
        const info = await readError(res);
        throw new Error(info.message ?? 'Unable to load QR tags.');
      }
      const body = await res.json();
      const list: QrTag[] = Array.isArray(body) ? body : body?.tags ?? [];
      if (mountedRef.current) {
        setTags(list);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unable to load QR tags.');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [petId]);

  useEffect(() => {
    void load();
  }, [load]);

  const issueReplacement = useCallback(
    async (revokedTagId: string): Promise<ReplacementIssuance | null> => {
      if (!petId) {
        return null;
      }
      setIsIssuing(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/pets/${encodeURIComponent(petId)}/qr-tags/${encodeURIComponent(revokedTagId)}/replace`,
          {
            method: 'POST',
            cache: 'no-store',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ petId, revokedTagId }),
          },
        );
        if (res.status === 401 || res.status === 403) {
          if (mountedRef.current) {
            setDenied(true);
          }
          return null;
        }
        if (!res.ok) {
          const info = await readError(res);
          throw new Error(info.message ?? 'Unable to issue a replacement tag.');
        }
        const body = await res.json();
        const newTag: QrTag | undefined = body?.newTag ?? body?.tag;
        if (!newTag) {
          throw new Error('Replacement response was missing the new tag.');
        }
        // Re-fetch the authoritative inventory so the revoked code cannot be
        // reactivated from a stale cache; fall back to a local merge.
        await load();
        if (mountedRef.current) {
          setTags((prev) => {
            const withoutStale = prev.filter((t) => t.id !== newTag.id);
            return [...withoutStale, newTag];
          });
        }
        return { revokedTagId, newTag };
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Unable to issue a replacement tag.');
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setIsIssuing(false);
        }
      }
    },
    [petId, load],
  );

  const activeTags = tags.filter((t) => t.status === 'active');
  const revokedTags = tags.filter((t) => t.status === 'revoked');

  return {
    tags,
    activeTags,
    revokedTags,
    isLoading,
    isIssuing,
    error,
    denied,
    reload: load,
    issueReplacement,
  };
}
