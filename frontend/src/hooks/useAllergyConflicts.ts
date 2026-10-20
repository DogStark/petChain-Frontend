import { useCallback, useMemo, useState } from 'react';

export interface AllergyRecord {
  id: string;
  petId: string;
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  recordedAt?: string;
}

export interface AllergyConflict {
  allergy: AllergyRecord;
  matchedTerm: string;
}

export interface ClinicianOverride {
  conflictId: string;
  rationale: string;
  clinicianId?: string;
  recordedAt: string;
}

export interface UseAllergyConflictsOptions {
  petId: string | null | undefined;
  allergies: AllergyRecord[];
  /** Whether the current user is permitted to document an override. */
  canOverride?: boolean;
}

const normalize = (value: string): string => value.trim().toLowerCase();

/**
 * Detects whether a free-text medication/treatment entry mentions any of the
 * pet's known allergies. Matching is case-insensitive and substring based so
 * that entries like "Amoxicillin 250mg" match an "amoxicillin" allergy.
 */
export function detectAllergyConflicts(
  entry: string,
  allergies: AllergyRecord[],
): AllergyConflict[] {
  const haystack = normalize(entry);
  if (!haystack) return [];

  const conflicts: AllergyConflict[] = [];
  for (const allergy of allergies) {
    const term = normalize(allergy.allergen);
    if (!term) continue;
    if (haystack.includes(term)) {
      conflicts.push({ allergy, matchedTerm: allergy.allergen });
    }
  }
  return conflicts;
}

export function useAllergyConflicts({
  petId,
  allergies,
  canOverride = false,
}: UseAllergyConflictsOptions) {
  const [entry, setEntry] = useState('');
  const [overrides, setOverrides] = useState<ClinicianOverride[]>([]);

  const petAllergies = useMemo(
    () => (petId ? allergies.filter((a) => a.petId === petId) : []),
    [allergies, petId],
  );

  const conflicts = useMemo(
    () => detectAllergyConflicts(entry, petAllergies),
    [entry, petAllergies],
  );

  const overriddenIds = useMemo(
    () => new Set(overrides.map((o) => o.conflictId)),
    [overrides],
  );

  const unresolvedConflicts = useMemo(
    () => conflicts.filter((c) => !overriddenIds.has(c.allergy.id)),
    [conflicts, overriddenIds],
  );

  const hasBlockingConflict = unresolvedConflicts.length > 0;

  const recordOverride = useCallback(
    (conflict: AllergyConflict, rationale: string, clinicianId?: string) => {
      const trimmed = rationale.trim();
      if (!canOverride || !trimmed) return false;
      setOverrides((prev) => [
        ...prev.filter((o) => o.conflictId !== conflict.allergy.id),
        {
          conflictId: conflict.allergy.id,
          rationale: trimmed,
          clinicianId,
          recordedAt: new Date().toISOString(),
        },
      ]);
      return true;
    },
    [canOverride],
  );

  const clearOverrides = useCallback(() => setOverrides([]), []);

  return {
    entry,
    setEntry,
    conflicts,
    unresolvedConflicts,
    hasBlockingConflict,
    overrides,
    canOverride,
    recordOverride,
    clearOverrides,
  };
}
