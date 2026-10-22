'use client';

import { useMemo, useState } from 'react';

export type EncounterSourceKind =
  | 'diagnosis'
  | 'treatment'
  | 'lab_result'
  | 'follow_up';

export interface EncounterSourceItem {
  id: string;
  kind: EncounterSourceKind;
  label: string;
  detail?: string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface EncounterSummaryComposerProps {
  encounterId: string;
  items: EncounterSourceItem[];
  /** Backend-owned access decision. The composer never evaluates consent itself. */
  canCompose: boolean;
  onSave?: (summary: {
    encounterId: string;
    includedIds: string[];
    followUpInstructions: string;
  }) => void | Promise<void>;
}

const KIND_LABELS: Record<EncounterSourceKind, string> = {
  diagnosis: 'Diagnosis',
  treatment: 'Treatment',
  lab_result: 'Lab result',
  follow_up: 'Follow-up',
};

const KIND_ORDER: EncounterSourceKind[] = [
  'diagnosis',
  'treatment',
  'lab_result',
  'follow_up',
];

export function EncounterSummaryComposer({
  encounterId,
  items,
  canCompose,
  onSave,
}: EncounterSummaryComposerProps) {
  const [includedIds, setIncludedIds] = useState<string[]>(() =>
    items.map((item) => item.id),
  );
  const [followUpInstructions, setFollowUpInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    return KIND_ORDER.map((kind) => ({
      kind,
      items: items.filter((item) => item.kind === kind),
    })).filter((group) => group.items.length > 0);
  }, [items]);

  const includedItems = useMemo(
    () => items.filter((item) => includedIds.includes(item.id)),
    [items, includedIds],
  );

  function toggleItem(id: string) {
    setIncludedIds((current) =>
      current.includes(id)
        ? current.filter((existing) => existing !== id)
        : [...current, id],
    );
  }

  async function handleSave() {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave({ encounterId, includedIds, followUpInstructions });
    } finally {
      setSaving(false);
    }
  }

  if (!canCompose) {
    return (
      <section
        aria-labelledby="encounter-summary-heading"
        className="rounded-lg border border-gray-200 p-4"
      >
        <h2
          id="encounter-summary-heading"
          className="text-lg font-semibold text-gray-900"
        >
          Encounter summary
        </h2>
        <p role="status" className="mt-2 text-sm text-gray-600">
          You do not have access to compose a summary for this encounter.
        </p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section
        aria-labelledby="encounter-summary-heading"
        className="rounded-lg border border-gray-200 p-4"
      >
        <h2
          id="encounter-summary-heading"
          className="text-lg font-semibold text-gray-900"
        >
          Encounter summary
        </h2>
        <p role="status" className="mt-2 text-sm text-gray-600">
          No linked records are available to summarize yet.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="encounter-summary-heading"
      className="rounded-lg border border-gray-200 p-4"
    >
      <h2
        id="encounter-summary-heading"
        className="text-lg font-semibold text-gray-900"
      >
        Encounter summary
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Select the linked records to include. Each item keeps its source
        attribution.
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-gray-900">
          Linked records
        </legend>
        <div className="mt-2 space-y-4">
          {grouped.map((group) => (
            <div key={group.kind}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {KIND_LABELS[group.kind]}
              </h3>
              <ul className="mt-1 space-y-2">
                {group.items.map((item) => {
                  const checkboxId = `encounter-item-${item.id}`;
                  return (
                    <li key={item.id}>
                      <div className="flex items-start gap-2">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          className="mt-1"
                          checked={includedIds.includes(item.id)}
                          onChange={() => toggleItem(item.id)}
                        />
                        <label htmlFor={checkboxId} className="text-sm">
                          <span className="font-medium text-gray-900">
                            {item.label}
                          </span>
                          {item.detail ? (
                            <span className="block text-gray-600">
                              {item.detail}
                            </span>
                          ) : null}
                          <span className="block text-xs text-gray-500">
                            Source: {KIND_LABELS[item.kind]}
                            {item.recordedBy
                              ? ` \u00b7 ${item.recordedBy}`
                              : ''}
                            {item.recordedAt ? ` \u00b7 ${item.recordedAt}` : ''}
                          </span>
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <label
          htmlFor="encounter-follow-up"
          className="text-sm font-medium text-gray-900"
        >
          Follow-up instructions
        </label>
        <textarea
          id="encounter-follow-up"
          className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
          rows={3}
          value={followUpInstructions}
          onChange={(event) => setFollowUpInstructions(event.target.value)}
        />
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-900">Summary preview</h3>
        {includedItems.length === 0 ? (
          <p role="status" className="mt-1 text-sm text-gray-600">
            No records selected.
          </p>
        ) : (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {includedItems.map((item) => (
              <li key={item.id}>
                {item.label}{' '}
                <span className="text-xs text-gray-500">
                  ({KIND_LABELS[item.kind]})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        onClick={handleSave}
        disabled={saving || includedItems.length === 0}
      >
        {saving ? 'Saving\u2026' : 'Save summary'}
      </button>
    </section>
  );
}
