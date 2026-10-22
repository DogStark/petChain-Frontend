import React, { useMemo, useState } from 'react';

export interface AllergyRecord {
  id: string;
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
}

export interface RecordEntryFormProps {
  petId: string;
  allergies?: AllergyRecord[];
  onSubmit?: (payload: RecordEntryPayload) => void;
}

export interface RecordEntryPayload {
  petId: string;
  type: 'medication' | 'treatment';
  name: string;
  notes?: string;
  override?: {
    acknowledged: boolean;
    rationale: string;
    conflictAllergyIds: string[];
  };
}

const normalize = (value: string): string => value.trim().toLowerCase();

const findConflicts = (
  entry: string,
  allergies: AllergyRecord[],
): AllergyRecord[] => {
  const needle = normalize(entry);
  if (!needle) return [];
  return allergies.filter((allergy) => {
    const allergen = normalize(allergy.allergen);
    if (!allergen) return false;
    return needle.includes(allergen) || allergen.includes(needle);
  });
};

export const RecordEntryForm: React.FC<RecordEntryFormProps> = ({
  petId,
  allergies = [],
  onSubmit,
}) => {
  const [type, setType] = useState<'medication' | 'treatment'>('medication');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [overrideRationale, setOverrideRationale] = useState('');
  const [overrideAcknowledged, setOverrideAcknowledged] = useState(false);

  const conflicts = useMemo(() => findConflicts(name, allergies), [name, allergies]);
  const hasConflict = conflicts.length > 0;
  const overrideValid = !hasConflict || (overrideAcknowledged && overrideRationale.trim().length > 0);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !overrideValid) return;
    onSubmit?.({
      petId,
      type,
      name: name.trim(),
      notes: notes.trim() || undefined,
      override: hasConflict
        ? {
            acknowledged: overrideAcknowledged,
            rationale: overrideRationale.trim(),
            conflictAllergyIds: conflicts.map((c) => c.id),
          }
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Record entry form">
      <div>
        <label htmlFor="record-type">Record type</label>
        <select
          id="record-type"
          value={type}
          onChange={(e) => setType(e.target.value as 'medication' | 'treatment')}
        >
          <option value="medication">Medication</option>
          <option value="treatment">Treatment</option>
        </select>
      </div>

      <div>
        <label htmlFor="record-name">Name</label>
        <input
          id="record-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={hasConflict ? 'allergy-conflict-warning' : undefined}
          aria-invalid={hasConflict ? true : undefined}
          required
        />
      </div>

      {hasConflict && (
        <div
          id="allergy-conflict-warning"
          role="alert"
          aria-live="assertive"
          style={{ border: '1px solid #b00020', padding: '0.75rem', marginTop: '0.5rem' }}
        >
          <strong>Allergy conflict detected</strong>
          <p>
            This {type} may conflict with a known allergy for this pet. Review the source
            record before continuing.
          </p>
          <ul>
            {conflicts.map((allergy) => (
              <li key={allergy.id}>
                <a href={`/pets/${petId}/allergies/${allergy.id}`}>
                  {allergy.allergen}
                  {allergy.reaction ? ` — ${allergy.reaction}` : ''}
                  {allergy.severity ? ` (${allergy.severity})` : ''}
                </a>
              </li>
            ))}
          </ul>

          <fieldset>
            <legend>Clinician override</legend>
            <label htmlFor="override-acknowledge">
              <input
                id="override-acknowledge"
                type="checkbox"
                checked={overrideAcknowledged}
                onChange={(e) => setOverrideAcknowledged(e.target.checked)}
              />{' '}
              I have reviewed the allergy record and confirm this entry is clinically
              appropriate.
            </label>
            <div>
              <label htmlFor="override-rationale">Override rationale (required)</label>
              <textarea
                id="override-rationale"
                value={overrideRationale}
                onChange={(e) => setOverrideRationale(e.target.value)}
                aria-required="true"
                required
              />
            </div>
          </fieldset>
        </div>
      )}

      <div>
        <label htmlFor="record-notes">Notes</label>
        <textarea
          id="record-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button type="submit" disabled={!name.trim() || !overrideValid}>
        Save record
      </button>
    </form>
  );
};

export default RecordEntryForm;
