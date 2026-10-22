import React, { useId, useMemo, useState } from 'react';

export interface AllergyRecord {
  id: string;
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  recordedAt?: string;
}

export interface AllergyConflictWarningProps {
  /** The medication or treatment text being entered. */
  entryText: string;
  /** Known allergies for the pet, sourced from allergy records. */
  allergies: AllergyRecord[];
  /** Called when a clinician documents an override with a rationale. */
  onOverride?: (conflict: AllergyRecord, rationale: string) => void;
  /** Called when the clinician dismisses the warning without overriding. */
  onDismiss?: () => void;
  /** Optional link builder to the source allergy record. */
  buildRecordHref?: (allergy: AllergyRecord) => string;
}

const normalize = (value: string): string => value.trim().toLowerCase();

/**
 * Returns the allergies whose allergen appears in the entry text.
 * Matching is case-insensitive and substring-based so that e.g. "amoxicillin"
 * matches an allergy recorded as "Amoxicillin".
 */
export function findConflicts(
  entryText: string,
  allergies: AllergyRecord[],
): AllergyRecord[] {
  const haystack = normalize(entryText);
  if (!haystack) return [];
  return allergies.filter((allergy) => {
    const needle = normalize(allergy.allergen);
    return needle.length > 0 && haystack.includes(needle);
  });
}

const defaultHref = (allergy: AllergyRecord): string =>
  `/records/allergies/${encodeURIComponent(allergy.id)}`;

const severityLabel: Record<NonNullable<AllergyRecord['severity']>, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};

export const AllergyConflictWarning: React.FC<AllergyConflictWarningProps> = ({
  entryText,
  allergies,
  onOverride,
  onDismiss,
  buildRecordHref = defaultHref,
}) => {
  const conflicts = useMemo(
    () => findConflicts(entryText, allergies),
    [entryText, allergies],
  );
  const [rationale, setRationale] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const headingId = useId();
  const rationaleId = useId();

  if (conflicts.length === 0) return null;

  const trimmedRationale = rationale.trim();
  const canOverride = trimmedRationale.length > 0;

  const handleOverride = () => {
    if (!canOverride) return;
    conflicts.forEach((conflict) => onOverride?.(conflict, trimmedRationale));
    setRationale('');
    setShowOverride(false);
  };

  return (
    <section
      role="alert"
      aria-labelledby={headingId}
      className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <h3 id={headingId} className="text-sm font-semibold">
        Possible allergy conflict
      </h3>
      <p className="mt-1 text-sm">
        This entry mentions a known allergy for this pet. Review the source
        record before proceeding.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {conflicts.map((conflict) => (
          <li key={conflict.id}>
            <a
              href={buildRecordHref(conflict)}
              className="font-medium underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              {conflict.allergen}
            </a>
            {conflict.severity ? ` — ${severityLabel[conflict.severity]}` : null}
            {conflict.reaction ? ` (reaction: ${conflict.reaction})` : null}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowOverride((prev) => !prev)}
          aria-expanded={showOverride}
          aria-controls={rationaleId}
          className="rounded border border-amber-600 px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
        >
          {showOverride ? 'Cancel override' : 'Override with rationale'}
        </button>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded px-3 py-1 text-sm font-medium underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            Dismiss
          </button>
        ) : null}
      </div>

      {showOverride ? (
        <div id={rationaleId} className="mt-3">
          <label
            htmlFor={`${rationaleId}-input`}
            className="block text-sm font-medium"
          >
            Clinician rationale (required)
          </label>
          <textarea
            id={`${rationaleId}-input`}
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-amber-400 p-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            aria-describedby={`${rationaleId}-hint`}
          />
          <p id={`${rationaleId}-hint`} className="mt-1 text-xs">
            Document why this entry is safe despite the recorded allergy. This
            rationale is stored with the record.
          </p>
          <button
            type="button"
            onClick={handleOverride}
            disabled={!canOverride}
            className="mt-2 rounded bg-amber-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-800"
          >
            Confirm override
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default AllergyConflictWarning;
