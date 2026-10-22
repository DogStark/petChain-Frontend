'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

interface PetProfile {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  sex?: string;
  birthDate?: string;
  microchipId?: string;
  photoUrl?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  emergencyContact?: string;
  publicProfileEnabled?: boolean;
  publicProfileSlug?: string;
}

interface IdentityField {
  key: keyof PetProfile;
  label: string;
  group: 'identity' | 'contact';
}

const AVAILABLE_FIELDS: IdentityField[] = [
  { key: 'species', label: 'Species', group: 'identity' },
  { key: 'breed', label: 'Breed', group: 'identity' },
  { key: 'sex', label: 'Sex', group: 'identity' },
  { key: 'birthDate', label: 'Date of birth', group: 'identity' },
  { key: 'microchipId', label: 'Microchip ID', group: 'identity' },
  { key: 'ownerName', label: 'Owner name', group: 'contact' },
  { key: 'ownerPhone', label: 'Owner phone', group: 'contact' },
  { key: 'ownerEmail', label: 'Owner email', group: 'contact' },
  { key: 'emergencyContact', label: 'Emergency contact', group: 'contact' },
];

const DEFAULT_SELECTED: Array<keyof PetProfile> = [
  'species',
  'breed',
  'microchipId',
  'ownerName',
  'ownerPhone',
];

function formatIssuedAt(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PetIdentityCardPage() {
  const params = useParams<{ id: string }>();
  const petId = params?.id;

  const [pet, setPet] = useState<PetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Array<keyof PetProfile>>(DEFAULT_SELECTED);
  const [issuedAt] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!petId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/pets/${encodeURIComponent(petId)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          throw new Error('You do not have permission to view this pet.');
        }
        if (res.status === 404) {
          throw new Error('Pet not found.');
        }
        if (!res.ok) {
          throw new Error('Unable to load pet profile.');
        }
        return (await res.json()) as PetProfile;
      })
      .then((data) => {
        if (!cancelled) setPet(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [petId]);

  const publicProfileUrl = useMemo(() => {
    if (!pet?.publicProfileEnabled) return null;
    const slug = pet.publicProfileSlug || pet.id;
    if (typeof window === 'undefined') {
      return `/pets/public/${encodeURIComponent(slug)}`;
    }
    return `${window.location.origin}/pets/public/${encodeURIComponent(slug)}`;
  }, [pet]);

  const qrSrc = useMemo(() => {
    if (!publicProfileUrl) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
      publicProfileUrl,
    )}`;
  }, [publicProfileUrl]);

  const toggleField = (key: keyof PetProfile) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const visibleFields = AVAILABLE_FIELDS.filter(
    (field) => selected.includes(field.key) && pet?.[field.key],
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6" aria-busy="true">
        <p role="status">Loading pet identity card…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Pet identity card</h1>
        <p role="alert" className="mt-2 text-red-600">
          {error}
        </p>
      </main>
    );
  }

  if (!pet) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Pet identity card</h1>
        <p className="mt-2">No pet profile available.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Pet identity card</h1>
      <p className="mt-1 text-sm text-gray-600">
        Choose which fields appear on the printable card for clinic visits.
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Card fields</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AVAILABLE_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(field.key)}
                onChange={() => toggleField(field.key)}
                aria-label={`Include ${field.label} on card`}
              />
              {field.label}
            </label>
          ))}
        </div>
      </fieldset>

      <section
        aria-label="Printable pet identity card"
        className="mt-6 rounded-lg border border-gray-300 p-4"
      >
        <div className="flex items-start gap-4">
          {pet.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pet.photoUrl}
              alt={`Photo of ${pet.name}`}
              className="h-20 w-20 rounded object-cover"
            />
          ) : null}
          <div>
            <h2 className="text-lg font-semibold">{pet.name}</h2>
            <p className="text-xs text-gray-600">
              Issued {formatIssuedAt(issuedAt)}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visibleFields.map((field) => (
            <div key={field.key}>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                {field.label}
              </dt>
              <dd className="text-sm">{String(pet[field.key])}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 border-t border-gray-200 pt-3">
          {publicProfileUrl && qrSrc ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt={`QR code linking to the public profile of ${pet.name}`}
                className="h-24 w-24"
              />
              <a
                href={publicProfileUrl}
                className="text-sm text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                View public profile
              </a>
            </div>
          ) : (
            <p className="text-xs text-gray-600">
              Public profile is disabled, so no QR link is included.
            </p>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={() => window.print()}
        className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
      >
        Print card
      </button>
    </main>
  );
}
