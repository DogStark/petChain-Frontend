import React from 'react';
import { Check, Eye, Lock } from 'lucide-react';
import { PetEmergencyInfo } from '@/types/pet';
import { buildCompletenessPreview } from '@/utils/emergencyProfilePreview';

interface EmergencyProfileCompletenessPreviewProps {
  /** The owner's current emergency profile (may be null while loading). */
  profile: PetEmergencyInfo | null | undefined;
  /** Optional id so the section can be referenced by aria-labelledby. */
  id?: string;
}

/**
 * Renders a concise, accessible checklist of exactly which emergency fields a
 * public QR scan will reveal — before the owner publishes or changes the
 * profile. Built on the same privacy projection (`projectEmergencyProfile`)
 * that powers the live scanner preview, so the two never drift.
 *
 * Keyboard / screen-reader friendly: a labelled <section>, a real <ul> list,
 * and per-row status text that does not rely on colour alone.
 */
export function EmergencyProfileCompletenessPreview({
  profile,
  id,
}: EmergencyProfileCompletenessPreviewProps) {
  const rows = buildCompletenessPreview(profile);
  const visibleCount = rows.filter((r) => r.visible).length;

  return (
    <section
      id={id}
      aria-label="Public scan field preview"
      className="bg-white border border-red-100 rounded-2xl p-4 shadow-sm"
    >
      <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
        <Eye size={16} className="text-red-600" aria-hidden="true" />
        What the public scan will show
      </h2>
      <p className="text-xs text-gray-500 mt-1" role="status">
        {visibleCount === 0
          ? 'No emergency fields are currently visible to anonymous scanners.'
          : `${visibleCount} of ${rows.length} field categories will appear on mobile and desktop.`}
      </p>
      <ul role="list" className="mt-3 space-y-2">
        {rows.map((row) => (
          <li
            key={row.key}
            role="listitem"
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="font-medium text-gray-800">{row.label}</span>
            {row.visible ? (
              <span
                className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 text-xs font-bold"
                aria-label={`${row.label} will be shown on the public scan`}
              >
                <Check size={12} aria-hidden="true" /> Shown
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 text-xs font-bold"
                aria-label={
                  row.hasContent
                    ? `${row.label} is hidden from the public scan, but you have data saved — switch it to public to include it`
                    : `${row.label} is hidden from the public scan`
                }
              >
                <Lock size={12} aria-hidden="true" /> Hidden
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default EmergencyProfileCompletenessPreview;
