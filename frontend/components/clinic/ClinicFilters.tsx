'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface ClinicFilterState {
  services: string[];
  openNow: boolean;
  hasAvailability: boolean;
}

export interface ClinicFiltersProps {
  availableServices: string[];
  onChange?: (filters: ClinicFilterState) => void;
}

const SERVICES_PARAM = 'services';
const OPEN_NOW_PARAM = 'openNow';
const AVAILABILITY_PARAM = 'available';

export function parseClinicFilters(searchParams: URLSearchParams): ClinicFilterState {
  const services = (searchParams.get(SERVICES_PARAM) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    services,
    openNow: searchParams.get(OPEN_NOW_PARAM) === 'true',
    hasAvailability: searchParams.get(AVAILABILITY_PARAM) === 'true',
  };
}

export default function ClinicFilters({ availableServices, onChange }: ClinicFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<ClinicFilterState>(() =>
    parseClinicFilters(new URLSearchParams(searchParams?.toString() ?? '')),
  );

  // Keep local state in sync when the URL changes (back/forward navigation).
  useEffect(() => {
    setFilters(parseClinicFilters(new URLSearchParams(searchParams?.toString() ?? '')));
  }, [searchParams]);

  const syncUrl = useCallback(
    (next: ClinicFilterState) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');

      if (next.services.length > 0) {
        params.set(SERVICES_PARAM, next.services.join(','));
      } else {
        params.delete(SERVICES_PARAM);
      }

      if (next.openNow) {
        params.set(OPEN_NOW_PARAM, 'true');
      } else {
        params.delete(OPEN_NOW_PARAM);
      }

      if (next.hasAvailability) {
        params.set(AVAILABILITY_PARAM, 'true');
      } else {
        params.delete(AVAILABILITY_PARAM);
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const update = useCallback(
    (next: ClinicFilterState) => {
      setFilters(next);
      syncUrl(next);
      onChange?.(next);
    },
    [onChange, syncUrl],
  );

  const toggleService = useCallback(
    (service: string) => {
      const has = filters.services.includes(service);
      const services = has
        ? filters.services.filter((s) => s !== service)
        : [...filters.services, service];
      update({ ...filters, services });
    },
    [filters, update],
  );

  const toggleOpenNow = useCallback(() => {
    update({ ...filters, openNow: !filters.openNow });
  }, [filters, update]);

  const toggleAvailability = useCallback(() => {
    update({ ...filters, hasAvailability: !filters.hasAvailability });
  }, [filters, update]);

  const clearAll = useCallback(() => {
    update({ services: [], openNow: false, hasAvailability: false });
  }, [update]);

  const hasActiveFilters = useMemo(
    () => filters.services.length > 0 || filters.openNow || filters.hasAvailability,
    [filters],
  );

  return (
    <section aria-label="Clinic filters" className="flex flex-col gap-3">
      <div role="group" aria-label="Supported services" className="flex flex-wrap gap-2">
        {availableServices.map((service) => {
          const active = filters.services.includes(service);
          return (
            <button
              key={service}
              type="button"
              aria-pressed={active}
              onClick={() => toggleService(service)}
              className={`rounded-full border px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
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

      <div role="group" aria-label="Availability filters" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={filters.openNow}
          onClick={toggleOpenNow}
          className={`rounded-full border px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            filters.openNow
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-gray-300 bg-white text-gray-700'
          }`}
        >
          Open now
        </button>
        <button
          type="button"
          aria-pressed={filters.hasAvailability}
          onClick={toggleAvailability}
          className={`rounded-full border px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            filters.hasAvailability
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-gray-300 bg-white text-gray-700'
          }`}
        >
          Has availability
        </button>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="self-start text-sm text-blue-600 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          Clear filters
        </button>
      )}
    </section>
  );
}
