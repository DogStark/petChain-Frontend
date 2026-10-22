'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface ClinicComparison {
  id: string;
  name: string;
  distanceKm: number | null;
  services: string[];
  openingHours: Record<string, string> | null;
  verifiedCredentials: string[];
}

interface ComparisonResponse {
  clinics: ClinicComparison[];
  dataTimestamp: string;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default function ClinicComparePage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const loadComparison = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setComparison(null);
      setError(null);
      setDenied(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDenied(false);

    try {
      const params = new URLSearchParams();
      ids.forEach((id) => params.append('clinicId', id));
      const response = await fetch(`/api/clinics/compare?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });

      if (response.status === 401 || response.status === 403) {
        setDenied(true);
        setComparison(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Unable to load clinic comparison.');
      }

      const data = (await response.json()) as ComparisonResponse;
      setComparison(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load clinic comparison.');
      setComparison(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadComparison(selectedIds);
  }, [selectedIds, loadComparison]);

  const toggleClinic = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const clinics = comparison?.clinics ?? [];

  const allServices = useMemo(() => {
    const set = new Set<string>();
    clinics.forEach((clinic) => clinic.services.forEach((service) => set.add(service)));
    return Array.from(set).sort();
  }, [clinics]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Compare clinics</h1>
      <p className="mt-2 text-sm text-gray-600">
        Select clinics to compare distance, services, opening hours, and verified credentials.
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">Clinics to compare</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {clinics.length === 0 && !loading && !denied && !error ? (
            <p className="text-sm text-gray-500">No clinics selected yet.</p>
          ) : null}
          {clinics.map((clinic) => (
            <label key={clinic.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(clinic.id)}
                onChange={() => toggleClinic(clinic.id)}
              />
              {clinic.name}
            </label>
          ))}
        </div>
      </fieldset>

      {loading ? (
        <p role="status" className="mt-4 text-sm text-gray-600">
          Loading comparison…
        </p>
      ) : null}

      {denied ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          You do not have access to compare these clinics.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {comparison && clinics.length > 0 ? (
        <section aria-label="Clinic comparison" className="mt-6 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <caption className="sr-only">
              Comparison of selected clinics on distance, services, opening hours, and verified
              credentials.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="border-b px-3 py-2 text-left">
                  Attribute
                </th>
                {clinics.map((clinic) => (
                  <th key={clinic.id} scope="col" className="border-b px-3 py-2 text-left">
                    {clinic.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="border-b px-3 py-2 text-left font-medium">
                  Distance
                </th>
                {clinics.map((clinic) => (
                  <td key={clinic.id} className="border-b px-3 py-2">
                    {clinic.distanceKm === null ? 'Unknown' : `${clinic.distanceKm} km`}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="border-b px-3 py-2 text-left font-medium">
                  Services
                </th>
                {clinics.map((clinic) => (
                  <td key={clinic.id} className="border-b px-3 py-2">
                    {allServices.length === 0 ? (
                      'None listed'
                    ) : (
                      <ul className="list-disc pl-4">
                        {allServices.map((service) => (
                          <li key={service}>
                            {clinic.services.includes(service) ? service : '—'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="border-b px-3 py-2 text-left font-medium">
                  Opening hours
                </th>
                {clinics.map((clinic) => (
                  <td key={clinic.id} className="border-b px-3 py-2">
                    {clinic.openingHours ? (
                      <ul className="list-none">
                        {DAYS.map((day) => (
                          <li key={day}>
                            <span className="capitalize">{day}:</span>{' '}
                            {clinic.openingHours?.[day] ?? 'Closed'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      'Not provided'
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="border-b px-3 py-2 text-left font-medium">
                  Verified credentials
                </th>
                {clinics.map((clinic) => (
                  <td key={clinic.id} className="border-b px-3 py-2">
                    {clinic.verifiedCredentials.length === 0 ? (
                      'None verified'
                    ) : (
                      <ul className="list-disc pl-4">
                        {clinic.verifiedCredentials.map((credential) => (
                          <li key={credential}>{credential}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            Data as of{' '}
            <time dateTime={comparison.dataTimestamp}>
              {formatTimestamp(comparison.dataTimestamp)}
            </time>
          </p>
        </section>
      ) : null}
    </main>
  );
}
