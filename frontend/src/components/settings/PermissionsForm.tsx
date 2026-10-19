import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * PermissionsForm
 *
 * Tracks unsaved (dirty) consent changes per form section and protects users
 * from abandoning edits through navigation (browser back, tab close, refresh)
 * or in-app route changes. Dirty state is reset only after a confirmed server
 * success. Failed saves preserve edits and never issue duplicate in-flight
 * requests.
 */

export interface PermissionSection {
  id: string;
  label: string;
  description?: string;
  value: boolean;
}

export interface PermissionsFormProps {
  /** Initial server-known state for each section. */
  initialSections: PermissionSection[];
  /** Persist a single section. Must resolve on confirmed server success. */
  onSaveSection: (section: PermissionSection) => Promise<void>;
  /** Optional in-app navigation guard registration. */
  registerNavigationGuard?: (guard: (nextUrl?: string) => boolean) => () => void;
  /** Optional programmatic redirect that should bypass the guard. */
  onSafeRedirect?: (url: string) => void;
}

const UNSAVED_MESSAGE =
  'You have unsaved consent changes. Leaving now will discard them.';

function sectionsEqual(a: PermissionSection, b: PermissionSection): boolean {
  return a.value === b.value;
}

export const PermissionsForm: React.FC<PermissionsFormProps> = ({
  initialSections,
  onSaveSection,
  registerNavigationGuard,
  onSafeRedirect,
}) => {
  const [sections, setSections] = useState<PermissionSection[]>(initialSections);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Keep the latest committed server state so we can compute dirtiness and
  // reset only the sections that were confirmed saved.
  const committedRef = useRef<PermissionSection[]>(initialSections);
  // Guard against duplicate in-flight requests per section.
  const inFlightRef = useRef<Set<string>>(new Set());
  // Allow safe programmatic redirects to bypass the navigation warning.
  const allowNavigationRef = useRef(false);

  const isDirty = dirtyIds.size > 0;

  const committedById = useMemo(() => {
    const map = new Map<string, PermissionSection>();
    committedRef.current.forEach((s) => map.set(s.id, s));
    return map;
  }, [sections]);

  const recomputeDirty = useCallback(
    (next: PermissionSection[]) => {
      const nextDirty = new Set<string>();
      next.forEach((section) => {
        const committed = committedById.get(section.id);
        if (committed && !sectionsEqual(section, committed)) {
          nextDirty.add(section.id);
        }
      });
      setDirtyIds(nextDirty);
    },
    [committedById],
  );

  const handleToggle = useCallback(
    (id: string) => {
      setSections((prev) => {
        const next = prev.map((s) =>
          s.id === id ? { ...s, value: !s.value } : s,
        );
        recomputeDirty(next);
        return next;
      });
      setErrors((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [recomputeDirty],
  );

  const handleSave = useCallback(
    async (id: string) => {
      // Prevent duplicate in-flight requests for the same section.
      if (inFlightRef.current.has(id)) return;
      const section = sections.find((s) => s.id === id);
      if (!section) return;

      inFlightRef.current.add(id);
      setSavingIds((prev) => new Set(prev).add(id));

      try {
        await onSaveSection(section);
        // Confirmed server success: commit and reset dirty for this section.
        committedRef.current = committedRef.current.map((s) =>
          s.id === id ? { ...section } : s,
        );
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setErrors((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } catch (err) {
        // Failed save preserves edits; surface an accessible error.
        setErrors((prev) => ({
          ...prev,
          [id]:
            err instanceof Error && err.message
              ? err.message
              : 'Could not save this section. Your changes are preserved.',
        }));
      } finally {
        inFlightRef.current.delete(id);
        setSavingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [onSaveSection, sections],
  );

  // Browser-level protection: back, refresh, tab close.
  useEffect(() => {
    if (!isDirty) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return undefined;
      event.preventDefault();
      event.returnValue = UNSAVED_MESSAGE;
      return UNSAVED_MESSAGE;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // In-app route guard: warns on navigation but allows safe programmatic
  // redirects to proceed without blocking.
  useEffect(() => {
    if (!registerNavigationGuard) return undefined;

    const guard = (nextUrl?: string): boolean => {
      if (allowNavigationRef.current) return true;
      if (!isDirty) return true;
      const proceed = window.confirm(UNSAVED_MESSAGE);
      if (proceed) {
        allowNavigationRef.current = true;
        if (nextUrl && onSafeRedirect) onSafeRedirect(nextUrl);
      }
      return proceed;
    };

    return registerNavigationGuard(guard);
  }, [isDirty, onSafeRedirect, registerNavigationGuard]);

  const handleSafeRedirect = useCallback(
    (url: string) => {
      allowNavigationRef.current = true;
      if (onSafeRedirect) onSafeRedirect(url);
    },
    [onSafeRedirect],
  );

  return (
    <form
      className="permissions-form"
      aria-label="Consent permissions"
      onSubmit={(e) => e.preventDefault()}
    >
      <fieldset>
        <legend>Visibility permissions</legend>
        {sections.map((section) => {
          const dirty = dirtyIds.has(section.id);
          const saving = savingIds.has(section.id);
          const error = errors[section.id];
          const errorId = `permissions-error-${section.id}`;

          return (
            <div key={section.id} className="permissions-form__row">
              <label htmlFor={`permissions-toggle-${section.id}`}>
                {section.label}
                {section.description ? (
                  <span className="permissions-form__hint">
                    {section.description}
                  </span>
                ) : null}
              </label>
              <input
                id={`permissions-toggle-${section.id}`}
                type="checkbox"
                checked={section.value}
                disabled={saving}
                aria-describedby={error ? errorId : undefined}
                aria-invalid={error ? true : undefined}
                onChange={() => handleToggle(section.id)}
              />
              <button
                type="button"
                disabled={!dirty || saving}
                aria-busy={saving}
                onClick={() => handleSave(section.id)}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {dirty && !saving ? (
                <span className="permissions-form__dirty" role="status">
                  Unsaved changes
                </span>
              ) : null}
              {error ? (
                <span
                  id={errorId}
                  className="permissions-form__error"
                  role="alert"
                >
                  {error}
                </span>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      {isDirty ? (
        <p className="permissions-form__warning" role="status">
          {UNSAVED_MESSAGE}
        </p>
      ) : null}

      {onSafeRedirect ? (
        <button
          type="button"
          className="permissions-form__safe-redirect"
          onClick={() => handleSafeRedirect('/settings')}
        >
          Continue without saving
        </button>
      ) : null}
    </form>
  );
};

export default PermissionsForm;
