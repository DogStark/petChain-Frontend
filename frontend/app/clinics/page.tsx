'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface Clinic {
  id: string;
  name: string;
  services: string[];
  openNow: boolean;
  hasAvailability: boolean;
}

const SERVICE_OPTIONS = ['Vaccinations', 'Dental', 'Surgery', 'Grooming', 'Emergency'];

const FILTER_PARAM = 'filters';
const OPEN_NOW_PARAM = 'openNow';
const AVAILABILITY_PARAM = 'available';

export default function ClinicsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedServices = useMemo(() => {
    const raw = searchParams.get(FILTER_PARAM);
    return raw ? raw.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const openNowOnly = searchParams.get(OPEN_NOW_PARAM) === 'true';
  const availableOnly = searchParams.get(AVAILABILITY_PARAM) === 'true';

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const toggleService = useCallback(
    (service: string) => {
      updateParams((params) => {
        const current = new Set(selectedServices);
        if (current.has(service)) {
          current.delete(service);
        } else {
          current.add(service);
        }
        if (current.size > 0) {
          params.set(FILTER_PARAM, Array.from(current).join(','));
        } else {
          params.delete(FILTER_PARAM);
        }
      });
    },
    [selectedServices, updateParams],
  );

  const toggleOpenNow = useCallback(() => {
    updateParams((params) => {
      if (openNowOnly) {
        params.delete(OPEN_NOW_PARAM);
      } else {
        params.set(OPEN_NOW_PARAM, 'true');
      }
    });
  }, [openNowOnly, updateParams]);

  const toggleAvailability = useCallback(() => {
    updateParams((params) => {
      if (availableOnly) {
        params.delete(AVAILABILITY_PARAM);
      } else {
        params.set(AVAILABILITY_PARAM, 'true');
      }
    });
  }, [availableOnly, updateParams]);

  const clearFilters = useCallback(() => {
    updateParams((params) => {
      params.delete(FILTER_PARAM);
      params.delete(OPEN_NOW_PARAM);
      params.delete(AVAILABILITY_PARAM);
    });
  }, [updateParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (selectedServices.length > 0) {
      params.set('services', selectedServices.join(','));
    }
    if (openNowOnly) {
      params.set('openNow', 'true');
    }
    if (availableOnly) {
      params.set('available', 'true');
    }

    const query = params.toString();
    fetch(`/api/clinics${query ? `?${query}` : ''}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Unable to load clinics');
        }
        return res.json();
      })
      .then((data: Clinic[]) => {
        if (!cancelled) {
          setClinics(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load clinics. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedServices, openNowOnly, availableOnly]);

  const hasActiveFilters =
    selectedServices.length > 0 || openNowOnly || availableOnly;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Find a clinic</h1>

      <section aria-label="Clinic filters" className="mt-6 space-y-4">
        <fieldset>
          <legend className="text-sm font-medium">Services</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SERVICE_OPTIONS.map((service) => {
              const active = selectedServices.includes(service);
              return (
                <button
                  key={service}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleService(service)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {service}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={openNowOnly}
            onClick={toggleOpenNow}
            className={`rounded-full border px-3 py-1 text-sm ${
              openNowOnly
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            Open now
          </button>
          <button
            type="button"
            aria-pressed={availableOnly}
            onClick={toggleAvailability}
            className={`rounded-full border px-3 py-1 text-sm ${
              availableOnly
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            Has availability
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-transparent px-3 py-1 text-sm text-blue-600 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      <section aria-live="polite" className="mt-8">
        {loading && <p className="text-gray-600">Loading clinics…</p>}

        {!loading && error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}

        {!loading && !error && clinics.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-700">
              {hasActiveFilters
                ? 'No clinics match your filters.'
                : 'No clinics are available right now.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm text-white"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!loading && !error && clinics.length > 0 && (
          <ul className="space-y-3">
            {clinics.map((clinic) => (
              <li
                key={clinic.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <h2 className="text-lg font-medium">{clinic.name}</h2>
                <p className="text-sm text-gray-600">
                  {clinic.services.join(', ')}
                </p>
                <p className="text-sm text-gray-600">
                  {clinic.openNow ? 'Open now' : 'Closed'}
                  {clinic.hasAvailability ? ' · Availability available' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
