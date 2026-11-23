'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type QrTagStatus = 'active' | 'revoked';

export interface QrTag {
  id: string;
  code: string;
  status: QrTagStatus;
  issuedAt: string;
  revokedAt?: string | null;
  replacedByTagId?: string | null;
}

export interface QrTagInventoryProps {
  petId: string;
  /** Fetches the linked-tag inventory for a pet. Authorization is owned by the backend. */
  fetchTags: (petId: string) => Promise<QrTag[]>;
  /** Requests replacement issuance. Backend decides consent/authorization. */
  requestReplacement: (petId: string, revokedTagId: string) => Promise<QrTag>;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function maskCode(code: string): string {
  if (code.length <= 4) return '••••';
  return `${'•'.repeat(Math.max(0, code.length - 4))}${code.slice(-4)}`;
}

export default function QrTagInventory({
  petId,
  fetchTags,
  requestReplacement,
}: QrTagInventoryProps) {
  const [tags, setTags] = useState<QrTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDenied(false);
    try {
      const result = await fetchTags(petId);
      setTags(result);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        setDenied(true);
      } else {
        setError('Unable to load linked QR tags. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchTags, petId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTags = useMemo(
    () => tags.filter((tag) => tag.status === 'active'),
    [tags],
  );
  const revokedTags = useMemo(
    () => tags.filter((tag) => tag.status === 'revoked'),
    [tags],
  );

  const handleReplace = useCallback(
    async (tag: QrTag) => {
      setPendingTagId(tag.id);
      setNotice(null);
      setError(null);
      try {
        const replacement = await requestReplacement(petId, tag.id);
        // Replace the revoked tag in place and append the new active tag so a
        // stale cached code can never be shown as active again.
        setTags((prev) => {
          const next = prev.map((item) =>
            item.id === tag.id
              ? {
                  ...item,
                  status: 'revoked' as const,
                  revokedAt: item.revokedAt ?? new Date().toISOString(),
                  replacedByTagId: replacement.id,
                }
              : item,
          );
          return [...next.filter((item) => item.id !== replacement.id), replacement];
        });
        setNotice(
          `Replacement tag issued. The previous code ending in ${tag.code.slice(-4)} is now revoked.`,
        );
        noticeRef.current?.focus();
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 401 || status === 403) {
          setDenied(true);
        } else {
          setError('Replacement could not be issued. Please try again.');
        }
      } finally {
        setPendingTagId(null);
      }
    },
    [petId, requestReplacement],
  );

  if (loading) {
    return (
      <section aria-labelledby="qr-tag-inventory-heading" aria-busy="true">
        <h2 id="qr-tag-inventory-heading">Linked QR tags</h2>
        <p role="status">Loading linked QR tags…</p>
      </section>
    );
  }

  if (denied) {
    return (
      <section aria-labelledby="qr-tag-inventory-heading">
        <h2 id="qr-tag-inventory-heading">Linked QR tags</h2>
        <p role="alert">
          You do not have permission to view or manage QR tags for this pet.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="qr-tag-inventory-heading">
      <h2 id="qr-tag-inventory-heading">Linked QR tags</h2>

      {error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}

      {notice ? (
        <p role="status" tabIndex={-1} ref={noticeRef}>
          {notice}
        </p>
      ) : null}

      {tags.length === 0 ? (
        <p>No QR tags are linked to this pet yet.</p>
      ) : (
        <>
          <h3>Active tags</h3>
          {activeTags.length === 0 ? (
            <p>No active QR tags. Issue a replacement from a revoked tag below.</p>
          ) : (
            <ul>
              {activeTags.map((tag) => (
                <li key={tag.id}>
                  <span>Code ending {maskCode(tag.code)}</span>{' '}
                  <span>Issued {formatDate(tag.issuedAt)}</span>
                </li>
              ))}
            </ul>
          )}

          <h3>Revoked tags</h3>
          {revokedTags.length === 0 ? (
            <p>No revoked QR tags.</p>
          ) : (
            <ul>
              {revokedTags.map((tag) => {
                const isPending = pendingTagId === tag.id;
                return (
                  <li key={tag.id}>
                    <span>Code ending {maskCode(tag.code)}</span>{' '}
                    <span>Revoked {formatDate(tag.revokedAt)}</span>{' '}
                    <button
                      type="button"
                      onClick={() => void handleReplace(tag)}
                      disabled={isPending || pendingTagId !== null}
                      aria-describedby={`qr-tag-replace-help-${tag.id}`}
                    >
                      {isPending ? 'Issuing replacement…' : 'Issue replacement tag'}
                    </button>
                    <span id={`qr-tag-replace-help-${tag.id}`}>
                      Issues a new active tag and permanently retires this code.
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
