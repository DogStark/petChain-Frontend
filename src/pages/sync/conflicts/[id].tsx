import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { syncManager } from '@/lib/offline/syncManager';
import type { SyncConflictSnapshot } from '@/lib/offline/indexedDB';

type VersionChoice = 'local' | 'server';

function displayValue(value: unknown): string {
  if (value === undefined) return 'Not present';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? 'Not present';
  } catch {
    return 'Value cannot be displayed';
  }
}

function ConflictComparison() {
  const router = useRouter();
  const { user, tokens } = useAuth();
  const conflictId =
    typeof router.query.id === 'string' ? router.query.id : null;
  const [conflict, setConflict] = useState<SyncConflictSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [choices, setChoices] = useState<Record<string, VersionChoice>>({});

  useEffect(() => {
    if (!router.isReady) return;
    if (!conflictId) {
      setConflict(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    setConflict(null);
    setError(null);
    setResolved(false);
    setChoices({});
    syncManager
      .getConflict(conflictId)
      .then((item) => {
        if (active) {
          setConflict(user?.id && item?.ownerId === user.id ? item : null);
        }
      })
      .catch(() => {
        if (active) setError('Unable to load this saved conflict.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [conflictId, router.isReady, user?.id]);

  const fields = useMemo(() => {
    if (!conflict) return [];
    return Array.from(
      new Set([...Object.keys(conflict.localData), ...Object.keys(conflict.serverData)]),
    ).sort();
  }, [conflict]);

  const handleResolve = async () => {
    if (!conflict || !conflictId || isSubmitting || fields.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    const selectedData: Record<string, unknown> = {};
    for (const field of fields) {
      const source = choices[field] ?? 'server';
      const value =
        source === 'local' ? conflict.localData[field] : conflict.serverData[field];
      if (value !== undefined) selectedData[field] = value;
    }

    try {
      if (!user) {
        throw new Error('Sign in to resolve this conflict.');
      }
      await syncManager.resolveConflict(
        conflictId,
        selectedData,
        user.id,
        tokens?.accessToken,
      );
      setConflict(null);
      setResolved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save your conflict resolution. Your saved comparison is still available.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Compare sync conflict - PetChain</title>
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-2xl font-bold">Compare sync conflict</h1>
          <p className="mt-2 text-sm text-gray-700">
            Review the saved and server versions field by field. Your choices
            are sent to the server, which validates and authorizes the update.
          </p>
        </header>

        {isLoading && (
          <p role="status" aria-live="polite">
            Loading conflict comparison…
          </p>
        )}

        {error && (
          <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
            {error}
          </p>
        )}

        {resolved && (
          <section aria-labelledby="conflict-resolved-title">
            <h2 id="conflict-resolved-title" className="text-lg font-semibold">
              Conflict resolved
            </h2>
            <p role="status">The server accepted your selected field values.</p>
          </section>
        )}

        {!isLoading && !error && !resolved && !conflict && (
          <p role="status">
            This conflict is unavailable. It may have already been resolved or
            removed from this device.
          </p>
        )}

        {!isLoading && conflict && fields.length === 0 && !resolved && (
          <p role="status">
            No comparable fields were included with this server conflict. Your
            queued change has not been discarded.
          </p>
        )}

        {!isLoading && conflict && fields.length > 0 && !resolved && (
          <section aria-labelledby="field-comparison-heading">
            <h2 id="field-comparison-heading" className="text-lg font-semibold">
              Field-by-field comparison
            </h2>
            <div className="mt-4 space-y-4">
              {fields.map((field, index) => {
                const selected = choices[field] ?? 'server';
                return (
                  <fieldset
                    key={field}
                    className="rounded-lg border border-gray-300 bg-white p-4"
                  >
                    <legend className="px-1 font-semibold">
                      {field || `Field ${index + 1}`}
                    </legend>
                    {(['local', 'server'] as const).map((source) => {
                      const value =
                        source === 'local'
                          ? conflict.localData[field]
                          : conflict.serverData[field];
                      return (
                        <label
                          key={source}
                          className="mt-3 flex cursor-pointer items-start gap-3 rounded border border-gray-200 p-3 focus-within:ring-2 focus-within:ring-blue-600"
                        >
                          <input
                            type="radio"
                            name={`conflict-field-${index}`}
                            value={source}
                            checked={selected === source}
                            onChange={() =>
                              setChoices((current) => ({ ...current, [field]: source }))
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">
                              {source === 'local' ? 'Saved version' : 'Server version'}
                              {selected === source ? ' (selected)' : ''}
                            </span>
                            <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm">
                              {displayValue(value)}
                            </pre>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleResolve}
              disabled={isSubmitting}
              className="mt-5 rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving resolution…' : 'Save selected values'}
            </button>
            {isSubmitting && (
              <p role="status" aria-live="polite" className="mt-2">
                Submitting your resolution to the server…
              </p>
            )}
          </section>
        )}

        <Link
          href="/"
          className="inline-block rounded underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Return to PetChain
        </Link>
      </main>
    </>
  );
}

export default function SyncConflictPage() {
  return (
    <ProtectedRoute>
      <ConflictComparison />
    </ProtectedRoute>
  );
}
