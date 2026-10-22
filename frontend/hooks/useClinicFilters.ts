import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface ClinicFilters {
  services: string[];
  openNow: boolean;
  hasAvailability: boolean;
}

const SERVICES_PARAM = 'services';
const OPEN_NOW_PARAM = 'openNow';
const AVAILABILITY_PARAM = 'available';

export const EMPTY_FILTERS: ClinicFilters = {
  services: [],
  openNow: false,
  hasAvailability: false,
};

function parseBoolean(value: string | null): boolean {
  return value === 'true' || value === '1';
}

function parseServices(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((service) => service.trim())
    .filter((service) => service.length > 0);
}

export function parseClinicFilters(params: URLSearchParams): ClinicFilters {
  return {
    services: parseServices(params.get(SERVICES_PARAM)),
    openNow: parseBoolean(params.get(OPEN_NOW_PARAM)),
    hasAvailability: parseBoolean(params.get(AVAILABILITY_PARAM)),
  };
}

export function serializeClinicFilters(filters: ClinicFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.services.length > 0) {
    params.set(SERVICES_PARAM, filters.services.join(','));
  }
  if (filters.openNow) {
    params.set(OPEN_NOW_PARAM, 'true');
  }
  if (filters.hasAvailability) {
    params.set(AVAILABILITY_PARAM, 'true');
  }
  return params;
}

export function hasActiveFilters(filters: ClinicFilters): boolean {
  return (
    filters.services.length > 0 || filters.openNow || filters.hasAvailability
  );
}

export interface UseClinicFiltersResult {
  filters: ClinicFilters;
  hasActiveFilters: boolean;
  toggleService: (service: string) => void;
  setOpenNow: (value: boolean) => void;
  setHasAvailability: (value: boolean) => void;
  clearFilters: () => void;
}

/**
 * Manages clinic search filters, keeping them synchronized with the URL query
 * string so filter state is shareable and survives reload / back navigation.
 *
 * Authorization and consent decisions remain owned by the backend; this hook
 * only reflects user-selected filter criteria.
 */
export function useClinicFilters(): UseClinicFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => parseClinicFilters(searchParams),
    [searchParams],
  );

  const updateFilters = useCallback(
    (next: ClinicFilters) => {
      setSearchParams(serializeClinicFilters(next), { replace: false });
    },
    [setSearchParams],
  );

  const toggleService = useCallback(
    (service: string) => {
      const current = parseClinicFilters(searchParams);
      const services = current.services.includes(service)
        ? current.services.filter((item) => item !== service)
        : [...current.services, service];
      updateFilters({ ...current, services });
    },
    [searchParams, updateFilters],
  );

  const setOpenNow = useCallback(
    (value: boolean) => {
      const current = parseClinicFilters(searchParams);
      updateFilters({ ...current, openNow: value });
    },
    [searchParams, updateFilters],
  );

  const setHasAvailability = useCallback(
    (value: boolean) => {
      const current = parseClinicFilters(searchParams);
      updateFilters({ ...current, hasAvailability: value });
    },
    [searchParams, updateFilters],
  );

  const clearFilters = useCallback(() => {
    updateFilters(EMPTY_FILTERS);
  }, [updateFilters]);

  return {
    filters,
    hasActiveFilters: hasActiveFilters(filters),
    toggleService,
    setOpenNow,
    setHasAvailability,
    clearFilters,
  };
}
