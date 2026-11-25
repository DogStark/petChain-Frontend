import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Check, QrCode, Printer } from 'lucide-react';
import { PetPhotosManager } from '@/components/PetPhotos';
import Avatar from '@/components/Avatar';
import { EmergencyQR } from '@/components/Profile/EmergencyQR';
import CareSetupChecklist from '@/components/Pets/CareSetupChecklist';
import HealthScoreExplanation from '@/components/Pets/HealthScoreExplanation';
import ResultsDashboard from '@/components/LabResults/ResultsDashboard';
import AttachmentQueueView from '@/components/Offline/AttachmentQueueView';
import PetDocumentsManager from '@/components/Pets/PetDocumentsManager';
import PetIdentityCard from '@/components/PetIdentityCard';
import styles from '@/styles/pages/PetDetailPage.module.css';
import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';
import { petAPI, type PetRecord, type PetUpsertPayload } from '@/lib/api/petAPI';

export const dynamic = 'force-dynamic';

const API_BASE_URL = getApiBaseUrl();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PetDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [pet, setPet] = useState<PetRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isNewPet = id === 'new';

  useEffect(() => {
    // Router not yet hydrated — stay in loading state until id is available
    if (!id || typeof id !== 'string') return;

    if (id === 'new') {
      setPet(null);
      setError(null);
      setIsEditing(true);
      setIsLoading(false);
      return;
    }

    // id is present but not a valid UUID — stop loading and surface an error
    if (!UUID_RE.test(id)) {
      setIsLoading(false);
      setIsEditing(false);
      setError('Invalid pet id');
      return;
    }

    setIsEditing(false);
    setError(null);
    // Use sanitized copy to break taint flow
    const safeId = id.replace(/[^0-9a-f-]/gi, '');

    const controller = new AbortController();
    let cancelled = false;

    const fetchPet = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${API_BASE_URL}/pets/${safeId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Pet not found' : 'Failed to load pet');
        }

        const data: PetRecord = await res.json();
        if (cancelled) return;
        setPet(data);
      } catch (err: unknown) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Failed to load pet');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPet();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading pet details...</span>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <PetEditor
        pet={pet}
        onCancel={() => {
          if (isNewPet) {
            void router.push('/dashboard');
          } else {
            setIsEditing(false);
          }
        }}
        onSaved={(savedPet) => {
          setPet(savedPet);
          setIsEditing(false);
          if (isNewPet) void router.replace(`/pets/${savedPet.id}`);
        }}
      />
    );
  }

  if (error || !pet) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Something went wrong</h2>
          <p>{error || 'Pet not found'}</p>
        </div>
      </div>
    );
  }

  const primaryPhoto = pet.photos?.find((p) => p.isPrimary);
  const age = getAge(pet.dateOfBirth);
  const breedName = getBreedName(pet.breed);

  const handlePrintCard = () => {
    if (typeof window === 'undefined') return;
    window.print();
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <button className={styles.backButton} onClick={() => router.back()}>
          <ArrowLeft size={16} />
          Back
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="mb-5 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Edit pet
        </button>

        <div className={styles.petHeader}>
          <Avatar
            src={primaryPhoto?.thumbnailUrl || primaryPhoto?.photoUrl}
            name={pet.name}
            type="pet"
            species={pet.species}
            size={80}
            className={styles.petAvatar}
            sizes="80px"
          />
          <div className={styles.petInfo}>
            <h1>{pet.name}</h1>
            <div className={styles.petMeta}>
              <span className={styles.metaItem}>{capitalize(pet.species.toLowerCase())}</span>
              {breedName && <span className={styles.metaItem}>{breedName}</span>}
              {age && <span className={styles.metaItem}>{age}</span>}
            </div>
          </div>
        </div>

        <CareSetupChecklist petId={pet.id} petName={pet.name} createdAt={pet.createdAt} />

        <section className={styles.section} aria-labelledby="pet-health-title">
          <h2 id="pet-health-title" className={styles.sectionTitle}>Health</h2>
          <HealthScoreExplanation petId={pet.id} />
          <div className="mt-6">
            <ResultsDashboard petId={pet.id} />
          </div>
          <div className="mt-8">
            <AttachmentQueueView petId={pet.id} />
          </div>
        </section>

        {/* QR Code Section */}
        <div className={styles.section}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={styles.sectionTitle}>QR Tag</h2>
            <button
              onClick={() => router.push(`/qrcode?petId=${pet.id}`)}
              className="flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-full hover:bg-gray-700 transition-all"
            >
              <QrCode size={14} /> Manage QR Codes
            </button>
          </div>
          <EmergencyQR petId={pet.id} petName={pet.name} />
        </div>

        {/* Pet Identity Card Section */}
        <div className={styles.section}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={styles.sectionTitle}>Identity Card</h2>
            <button
              onClick={handlePrintCard}
              className="flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-full hover:bg-gray-700 transition-all"
            >
              <Printer size={14} /> Print / Download Card
            </button>
          </div>
          <div ref={cardRef} className="pet-identity-card-print">
            <PetIdentityCard
              pet={{
                id: pet.id,
                name: pet.name,
                species: capitalize(pet.species),
                breed: breedName ? { name: breedName } : null,
                photoUrl: primaryPhoto?.photoUrl || primaryPhoto?.thumbnailUrl || null,
                microchipNumber: pet.microchipNumber,
              }}
              format="credit-card"
            />
          </div>
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .pet-identity-card-print,
              .pet-identity-card-print * {
                visibility: visible;
              }
              .pet-identity-card-print {
                position: absolute;
                top: 0;
                left: 0;
              }
              @page {
                size: auto;
                margin: 8mm;
              }
            }
          `}</style>
        </div>

        {/* Pet Photos Section */}
        <div className={styles.section}>
          <PetPhotosManager petId={pet.id} />
        </div>

        {/* Pet Documents Section */}
        <div className={styles.section}>
          <PetDocumentsManager petId={pet.id} />
        </div>

        {/* Pet Details Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Details</h2>
          <div className={styles.detailGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Species</span>
              <span className={styles.detailValue}>{capitalize(pet.species)}</span>
            </div>
            {breedName && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Breed</span>
                <span className={styles.detailValue}>{breedName}</span>
              </div>
            )}
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Gender</span>
              <span className={styles.detailValue}>{capitalize(pet.gender)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Date of Birth</span>
              <span className={styles.detailValue}>
                {new Date(pet.dateOfBirth).toLocaleDateString()}
              </span>
            </div>
            {pet.weight && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Weight</span>
                <span className={styles.detailValue}>{pet.weight} kg</span>
              </div>
            )}
            {pet.color && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Color</span>
                <span className={styles.detailValue}>{pet.color}</span>
              </div>
            )}
            {pet.microchipNumber && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Microchip</span>
                <span className={styles.detailValue}>{pet.microchipNumber}</span>
              </div>
            )}
            {pet.specialNeeds && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Special Needs</span>
                <span className={styles.detailValue}>{pet.specialNeeds}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PetEditorProps {
  pet: PetRecord | null;
  onCancel: () => void;
  onSaved: (pet: PetRecord) => void;
}

interface PetFormState extends Omit<PetUpsertPayload, 'weight' | 'breedId'> {
  breedId: string;
  breed: string;
  weight: string;
}

function PetEditor({ pet, onCancel, onSaved }: PetEditorProps) {
  const [form, setForm] = useState<PetFormState>(() => ({
    name: pet?.name ?? '',
    species: pet?.species?.toLowerCase() ?? 'dog',
    breed: getBreedName(pet?.breed) ?? '',
    breedId: pet?.breedId ?? (typeof pet?.breed === 'object' ? pet.breed?.id ?? '' : ''),
    gender: pet?.gender?.toLowerCase() ?? 'unknown',
    dateOfBirth: pet?.dateOfBirth?.slice(0, 10) ?? '',
    weight: pet?.weight == null ? '' : String(pet.weight),
    color: pet?.color ?? '',
    microchipNumber: pet?.microchipNumber ?? '',
    specialNeeds: pet?.specialNeeds ?? '',
  }));
  const [breeds, setBreeds] = useState<Array<{ id: string; name: string }>>([]);
  const [breedsLoading, setBreedsLoading] = useState(false);
  const [breedsError, setBreedsError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setBreedsLoading(true);
    setBreedsError(null);
    petAPI
      .getBreeds(form.species, controller.signal)
      .then((loadedBreeds) => {
        setBreeds(loadedBreeds);
        setForm((current) => {
          if (current.breedId || !current.breed.trim()) return current;
          const matchingBreed = loadedBreeds.find(
            (breed) => breed.name.toLowerCase() === current.breed.trim().toLowerCase(),
          );
          return matchingBreed ? { ...current, breedId: matchingBreed.id } : current;
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setBreedsError(err instanceof Error ? err.message : 'Unable to load breed suggestions');
      })
      .finally(() => {
        if (!controller.signal.aborted) setBreedsLoading(false);
      });

    return () => controller.abort();
  }, [form.species]);

  const matchingBreeds = breeds
    .filter((breed) => breed.name.toLowerCase().includes(form.breed.trim().toLowerCase()))
    .slice(0, 8);

  const chooseBreed = (breed: { id: string; name: string }) => {
    setForm((current) => ({ ...current, breed: breed.name, breedId: breed.id }));
    setShowSuggestions(false);
    setActiveSuggestion(-1);
  };

  const handleBreedKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && matchingBreeds.length > 0) {
      event.preventDefault();
      setShowSuggestions(true);
      setActiveSuggestion((current) => (current + 1) % matchingBreeds.length);
    } else if (event.key === 'ArrowUp' && matchingBreeds.length > 0) {
      event.preventDefault();
      setActiveSuggestion((current) =>
        current <= 0 ? matchingBreeds.length - 1 : current - 1,
      );
    } else if (
      event.key === 'Enter' &&
      showSuggestions &&
      activeSuggestion >= 0 &&
      matchingBreeds[activeSuggestion]
    ) {
      event.preventDefault();
      chooseBreed(matchingBreeds[activeSuggestion]);
    } else if (event.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
    if (form.breed.trim() && !form.breedId) {
      setSaveError('Select a breed from the suggestions or clear the breed field.');
      return;
    }
    setSaving(true);
    const payload: PetUpsertPayload = {
      name: form.name,
      species: form.species.toUpperCase(),
      ...(form.breedId ? { breedId: form.breedId } : {}),
      gender: form.gender.toUpperCase(),
      dateOfBirth: form.dateOfBirth,
      weight: form.weight ? Number(form.weight) : null,
      color: form.color.trim() || null,
      microchipNumber: form.microchipNumber.trim() || null,
      specialNeeds: form.specialNeeds.trim() || null,
    };

    try {
      const savedPet = pet
        ? await petAPI.updatePet(pet.id, payload)
        : await petAPI.createPet(payload);
      const selectedBreed = breeds.find((breed) => breed.id === form.breedId);
      onSaved({
        ...savedPet,
        breedId: form.breedId || null,
        breed:
          selectedBreed ??
          (form.breedId && form.breed ? { id: form.breedId, name: form.breed } : null),
      });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save pet details');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <button type="button" className={styles.backButton} onClick={onCancel}>
          <ArrowLeft size={16} />
          Cancel
        </button>
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold text-gray-900">{pet ? 'Edit pet' : 'Add a pet'}</h1>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Name</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Species</span>
              <select
                value={form.species}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    species: event.target.value,
                    breed: '',
                    breedId: '',
                  }))
                }
                className={inputClass}
              >
                {!['dog', 'cat', 'bird', 'fish', 'rabbit', 'hamster', 'reptile', 'other'].includes(form.species) && (
                  <option value={form.species}>{capitalize(form.species)}</option>
                )}
                {['dog', 'cat', 'bird', 'fish', 'rabbit', 'hamster', 'reptile', 'other'].map((species) => (
                  <option key={species} value={species}>{capitalize(species)}</option>
                ))}
              </select>
            </label>

            <label className="relative block space-y-1">
              <span className="text-sm font-medium text-gray-700">Breed</span>
              <input
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSuggestions && matchingBreeds.length > 0}
                aria-controls="pet-breed-options"
                aria-activedescendant={
                  activeSuggestion >= 0 ? `pet-breed-option-${activeSuggestion}` : undefined
                }
                value={form.breed}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowSuggestions(false), 100)}
                onKeyDown={handleBreedKeyDown}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    breed: event.target.value,
                    breedId: '',
                  }));
                  setActiveSuggestion(-1);
                  setShowSuggestions(true);
                }}
                autoComplete="off"
                className={inputClass}
                placeholder="Search breeds"
              />
              {showSuggestions && matchingBreeds.length > 0 && (
                <ul
                  id="pet-breed-options"
                  role="listbox"
                  className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                >
                  {matchingBreeds.map((breed, index) => (
                    <li
                      id={`pet-breed-option-${index}`}
                      key={breed.id}
                      role="option"
                      aria-selected={index === activeSuggestion}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => chooseBreed(breed)}
                      className={`cursor-pointer px-3 py-2 text-sm ${
                        index === activeSuggestion ? 'bg-blue-100' : 'hover:bg-gray-100'
                      }`}
                    >
                      {breed.name}
                    </li>
                  ))}
                </ul>
              )}
              {breedsLoading && <span className="text-xs text-gray-500">Loading breeds…</span>}
              {breedsError && <span role="alert" className="text-xs text-amber-700">{breedsError}. Leave the field blank to continue.</span>}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Gender</span>
              <select
                value={form.gender}
                onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                className={inputClass}
              >
                {['unknown', 'male', 'female'].map((gender) => (
                  <option key={gender} value={gender}>{capitalize(gender)}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Date of birth</span>
              <input
                required
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Weight (kg)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.weight}
                onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Color</span>
              <input
                value={form.color ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Microchip number</span>
            <input
              value={form.microchipNumber ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, microchipNumber: event.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Special needs</span>
            <textarea
              rows={3}
              value={form.specialNeeds ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, specialNeeds: event.target.value }))
              }
              className={inputClass}
            />
          </label>

          {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : <><Check size={16} /> Save pet</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getBreedName(breed: PetRecord['breed']): string {
  if (typeof breed === 'string') return breed;
  return breed?.name ?? '';
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getAge(dateOfBirth: string): string | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years--;
  }
  if (years < 1) {
    const months = Math.max(
      0,
      (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
    );
    return `${months} month${months === 1 ? '' : 's'} old`;
  }
  return `${years} year${years === 1 ? '' : 's'} old`;
}

function capitalize(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
