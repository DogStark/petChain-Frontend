import { useCallback, useMemo, useState } from 'react';

export type IdentityFieldKey =
  | 'petName'
  | 'species'
  | 'breed'
  | 'sex'
  | 'dateOfBirth'
  | 'microchipId'
  | 'ownerName'
  | 'ownerPhone'
  | 'ownerEmail'
  | 'emergencyContact';

export interface IdentityFieldOption {
  key: IdentityFieldKey;
  label: string;
  /** Contact fields are only rendered when the owner opts in. */
  isContact: boolean;
}

export const IDENTITY_FIELD_OPTIONS: IdentityFieldOption[] = [
  { key: 'petName', label: 'Pet name', isContact: false },
  { key: 'species', label: 'Species', isContact: false },
  { key: 'breed', label: 'Breed', isContact: false },
  { key: 'sex', label: 'Sex', isContact: false },
  { key: 'dateOfBirth', label: 'Date of birth', isContact: false },
  { key: 'microchipId', label: 'Microchip ID', isContact: false },
  { key: 'ownerName', label: 'Owner name', isContact: true },
  { key: 'ownerPhone', label: 'Owner phone', isContact: true },
  { key: 'ownerEmail', label: 'Owner email', isContact: true },
  { key: 'emergencyContact', label: 'Emergency contact', isContact: true },
];

const DEFAULT_SELECTED_FIELDS: IdentityFieldKey[] = [
  'petName',
  'species',
  'breed',
  'microchipId',
];

export interface PetIdentitySource {
  id: string;
  name?: string | null;
  species?: string | null;
  breed?: string | null;
  sex?: string | null;
  dateOfBirth?: string | null;
  microchipId?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  emergencyContact?: string | null;
  /** Backend-owned privacy decision for the pet's public profile. */
  publicProfileEnabled?: boolean;
  publicProfileSlug?: string | null;
}

export interface PetIdentityCardField {
  key: IdentityFieldKey;
  label: string;
  value: string;
}

export interface PetIdentityCardModel {
  petId: string;
  fields: PetIdentityCardField[];
  issuedAt: string;
  /** Null when the backend has not enabled a public profile for this pet. */
  publicProfileUrl: string | null;
  publicProfileEnabled: boolean;
}

export interface UsePetIdentityCardOptions {
  pet: PetIdentitySource | null | undefined;
  /** Base URL used to build the public profile link (e.g. window.location.origin). */
  publicProfileBaseUrl?: string;
  /** Injectable clock for deterministic issue timestamps in tests. */
  now?: () => Date;
  initialSelectedFields?: IdentityFieldKey[];
}

export interface UsePetIdentityCardResult {
  selectedFields: IdentityFieldKey[];
  toggleField: (key: IdentityFieldKey) => void;
  isSelected: (key: IdentityFieldKey) => boolean;
  card: PetIdentityCardModel | null;
  /** True when the pet exists but no identity fields are selected. */
  isEmpty: boolean;
  /** True when the backend has not granted a public profile link. */
  isPublicProfileDenied: boolean;
  /** Re-issues the card with a fresh timestamp. */
  reissue: () => void;
}

function resolveFieldValue(
  pet: PetIdentitySource,
  key: IdentityFieldKey,
): string | null {
  const raw = pet[key];
  if (raw === null || raw === undefined) {
    return null;
  }
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildPublicProfileUrl(
  pet: PetIdentitySource,
  baseUrl: string | undefined,
): string | null {
  if (!pet.publicProfileEnabled) {
    return null;
  }
  const slug = pet.publicProfileSlug?.trim();
  if (!slug) {
    return null;
  }
  const base = (baseUrl ?? '').replace(/\/+$/, '');
  return `${base}/pets/${encodeURIComponent(slug)}`;
}

export function usePetIdentityCard({
  pet,
  publicProfileBaseUrl,
  now,
  initialSelectedFields,
}: UsePetIdentityCardOptions): UsePetIdentityCardResult {
  const [selectedFields, setSelectedFields] = useState<IdentityFieldKey[]>(
    initialSelectedFields ?? DEFAULT_SELECTED_FIELDS,
  );
  const [issuedAt, setIssuedAt] = useState<string>(() =>
    (now ? now() : new Date()).toISOString(),
  );

  const toggleField = useCallback((key: IdentityFieldKey) => {
    setSelectedFields((current) =>
      current.includes(key)
        ? current.filter((field) => field !== key)
        : [...current, key],
    );
  }, []);

  const isSelected = useCallback(
    (key: IdentityFieldKey) => selectedFields.includes(key),
    [selectedFields],
  );

  const reissue = useCallback(() => {
    setIssuedAt((now ? now() : new Date()).toISOString());
  }, [now]);

  const card = useMemo<PetIdentityCardModel | null>(() => {
    if (!pet) {
      return null;
    }

    const fields: PetIdentityCardField[] = [];
    for (const option of IDENTITY_FIELD_OPTIONS) {
      if (!selectedFields.includes(option.key)) {
        continue;
      }
      const value = resolveFieldValue(pet, option.key);
      if (value === null) {
        continue;
      }
      fields.push({ key: option.key, label: option.label, value });
    }

    return {
      petId: pet.id,
      fields,
      issuedAt,
      publicProfileUrl: buildPublicProfileUrl(pet, publicProfileBaseUrl),
      publicProfileEnabled: Boolean(pet.publicProfileEnabled),
    };
  }, [pet, selectedFields, issuedAt, publicProfileBaseUrl]);

  return {
    selectedFields,
    toggleField,
    isSelected,
    card,
    isEmpty: card !== null && card.fields.length === 0,
    isPublicProfileDenied: card !== null && card.publicProfileUrl === null,
    reissue,
  };
}
