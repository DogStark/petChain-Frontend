'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

interface PetTag {
  id: string;
  code: string;
  status: 'active' | 'revoked';
  issuedAt: string;
  revokedAt?: string | null;
  replacedByTagId?: string | null;
}

interface TagsResponse {
  tags: PetTag[];
}

interface ReplacementResponse {
  tag: PetTag;
  revokedTagId: string;
}

const API_BASE = '/api';

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function PetTagsPage() {
  const params = useParams<{ id: string }>();
  const petId = params?.id;

  const [tags, setTags] = useState<PetTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    if (!petId) return;
    setLoading(true);
    setError(null);
    setDenied(false);
    try {
      const res = await fetch(`${API_BASE}/pets/${encodeURIComponent(petId)}/tags`, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401 || res.status === 403) {
        setDenied(true);
        setTags([]);
        return;
      }
      if (!res.ok) {
        throw new Error('Unable to load tags for this pet.');
      }
      const data = (await res.json()) as TagsResponse;
      setTags(Array.isArray(data.tags) ? data.tags : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tags for this pet.');
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const activeTags = useMemo(() => tags.filter((t) => t.status === 'active'), [tags]);
  const revokedTags = useMemo(() => tags.filter((t) => t.status === 'revoked'), [tags]);

  const handleReplace = useCallback(async () => {
    if (!petId) return;
    setReplacing(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_BASE}/pets/${encodeURIComponent(petId)}/tags/replace`, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status === 401 || res.status === 403) {
        setDenied(true);
        return;
      }
      if (!res.ok) {
        throw new Error('Replacement could not be issued. Please try again.');
      }
      const data = (await res.json()) as ReplacementResponse;
      setStatusMessage(
        `New tag issued. Previous code ${data.revokedTagId} has been revoked and cannot be reactivated.`,
      );
      setConfirming(false);
      await loadTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replacement could not be issued.');
    } finally {
      setReplacing(false);
    }
  }, [petId, loadTags]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8" aria-labelledby="tags-heading">
      <h1 id="tags-heading" className="text-2xl font-semibold">
        QR tags
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Active and revoked tags linked to this pet. Revoked codes stay revoked and cannot be
        reactivated, even from a cached browser session.
      </p>

      <div aria-live="polite" role="status" className="mt-4 min-h-[1.25rem] text-sm">
        {statusMessage}
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {denied ? (
        <section className="mt-6 rounded border border-gray-300 p-4" aria-label="Access denied">
          <h2 className="text-lg font-medium">Access denied</h2>
          <p className="mt-1 text-sm text-gray-700">
            You do not have permission to view or manage tags for this pet.
          </p>
        </section>
      ) : loading ? (
        <p className="mt-6 text-sm text-gray-600" role="status">
          Loading tags…
        </p>
      ) : (
        <>
          <section className="mt-6" aria-labelledby="active-tags-heading">
            <h2 id="active-tags-heading" className="text-lg font-medium">
              Active tags
            </h2>
            {activeTags.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No active tags for this pet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-200 rounded border border-gray-200">
                {activeTags.map((tag) => (
                  <li key={tag.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <span className="font-mono text-sm">{tag.code}</span>
                    <span className="text-xs text-gray-600">Issued {formatDate(tag.issuedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8" aria-labelledby="revoked-tags-heading">
            <h2 id="revoked-tags-heading" className="text-lg font-medium">
              Revoked tags
            </h2>
            {revokedTags.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">No revoked tags.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-200 rounded border border-gray-200">
                {revokedTags.map((tag) => (
                  <li key={tag.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <span className="font-mono text-sm line-through">{tag.code}</span>
                    <span className="text-xs text-gray-600">Revoked {formatDate(tag.revokedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8" aria-labelledby="replace-heading">
            <h2 id="replace-heading" className="text-lg font-medium">
              Replace tag
            </h2>
            <p className="mt-1 text-sm text-gray-700">
              Issuing a replacement revokes the current active code. The old code will no longer
              resolve to this pet.
            </p>
            {!confirming ? (
              <button
                type="button"
                className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50"
                onClick={() => setConfirming(true)}
                disabled={activeTags.length === 0 || replacing}
              >
                Issue replacement tag
              </button>
            ) : (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm text-amber-900">
                  Confirm replacement. The current active tag will be revoked immediately.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
                    onClick={() => void handleReplace()}
                    disabled={replacing}
                  >
                    {replacing ? 'Issuing…' : 'Confirm replacement'}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50"
                    onClick={() => setConfirming(false)}
                    disabled={replacing}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
