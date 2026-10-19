import { act, renderHook, waitFor } from "@testing-library/react";
import {
  CLINIC_SEARCH_DEBOUNCE_MS,
  filterClinics,
  matchesClinicQuery,
  useClinicSearch,
} from "./useClinicSearch";
import { clinicsAPI } from "@/lib/api/clinicsAPI";
import { Clinic } from "@/types/clinic";

jest.mock("@/lib/api/clinicsAPI", () => ({
  clinicsAPI: {
    getClinics: jest.fn(),
  },
}));

const getClinics = clinicsAPI.getClinics as jest.Mock;

function makeClinic(
  id: string,
  name: string,
  city: string,
  service = "General Checkup",
): Clinic {
  return {
    id,
    name,
    description: `${name} description`,
    rating: 4.5,
    reviewCount: 10,
    locations: [
      {
        id: `${id}-main`,
        name,
        address: "1 Main Street",
        city,
        phone: "020 0000 0000",
        email: `${id}@clinic.test`,
      },
    ],
    services: [{ id: `s-${id}`, name: service, description: "", priceRange: "" }],
    hours: [],
    staff: [],
  };
}

const londonClinic = makeClinic("1", "Pawfect Health Center", "London");
const parisClinic = makeClinic("2", "Paris Vet Clinic", "Paris", "Surgery");
const allClinics = [londonClinic, parisClinic];

describe("matchesClinicQuery", () => {
  it("matches name, city and service case-insensitively", () => {
    expect(matchesClinicQuery(londonClinic, "PAWFECT")).toBe(true);
    expect(matchesClinicQuery(londonClinic, "london")).toBe(true);
    expect(matchesClinicQuery(londonClinic, "general")).toBe(true);
    expect(matchesClinicQuery(parisClinic, "london")).toBe(false);
  });
});

describe("filterClinics", () => {
  it("returns the full list for queries shorter than the minimum", () => {
    expect(filterClinics(allClinics, "")).toEqual(allClinics);
    expect(filterClinics(allClinics, "l")).toEqual(allClinics);
    expect(filterClinics(allClinics, "   ")).toEqual(allClinics);
  });

  it("filters by the trimmed query once it is long enough", () => {
    expect(filterClinics(allClinics, " paris ")).toEqual([parisClinic]);
  });
});

describe("useClinicSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loads clinics once on mount and clears the loading state", async () => {
    getClinics.mockResolvedValue(allClinics);

    const { result } = renderHook(() => useClinicSearch());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.clinics).toEqual(allClinics);
    expect(result.current.results).toEqual(allClinics);
    expect(getClinics).toHaveBeenCalledTimes(1);
  });

  it("reports a load error and recovers on reload", async () => {
    getClinics
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(allClinics);

    const { result } = renderHook(() => useClinicSearch());

    await waitFor(() =>
      expect(result.current.error).toBe("Failed to load clinics."),
    );
    expect(result.current.loading).toBe(false);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.clinics).toHaveLength(2));
    expect(result.current.error).toBeNull();
  });

  it("ignores a stale in-flight response so only the latest load wins", async () => {
    const signals: AbortSignal[] = [];
    const resolvers: Array<(value: Clinic[]) => void> = [];

    getClinics.mockImplementation(
      (_city: string | undefined, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<Clinic[]>((resolve) => {
          resolvers.push(resolve);
        });
      },
    );

    const { result } = renderHook(() => useClinicSearch());

    expect(signals).toHaveLength(1);

    act(() => {
      result.current.reload();
    });

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    expect(getClinics).toHaveBeenCalledTimes(2);

    // The newest request resolves first.
    await act(async () => {
      resolvers[1](allClinics);
      await Promise.resolve();
    });
    expect(result.current.clinics).toEqual(allClinics);
    expect(result.current.loading).toBe(false);

    // The superseded request resolves late: its payload must be discarded.
    await act(async () => {
      resolvers[0]([londonClinic]);
      await Promise.resolve();
    });
    expect(result.current.clinics).toEqual(allClinics);
    expect(result.current.loading).toBe(false);
  });

  it("aborts the in-flight request when unmounted", () => {
    const signals: AbortSignal[] = [];

    getClinics.mockImplementation(
      (_city: string | undefined, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<Clinic[]>(() => undefined);
      },
    );

    const { unmount } = renderHook(() => useClinicSearch());

    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    unmount();

    expect(signals[0].aborted).toBe(true);
  });

  it("debounces typing and only applies the latest query", async () => {
    getClinics.mockResolvedValue(allClinics);

    const { result } = renderHook(() => useClinicSearch());
    await waitFor(() => expect(result.current.loading).toBe(false));

    jest.useFakeTimers();

    act(() => {
      result.current.setQuery("lon");
      result.current.setQuery("paw");
    });

    expect(result.current.isQueryActive).toBe(false);
    expect(result.current.isSearching).toBe(true);
    expect(result.current.results).toEqual(allClinics);

    act(() => {
      jest.advanceTimersByTime(CLINIC_SEARCH_DEBOUNCE_MS);
    });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.isQueryActive).toBe(true);
    expect(result.current.results).toEqual([londonClinic]);
  });

  it("applies the latest query immediately when submitted", async () => {
    getClinics.mockResolvedValue(allClinics);

    const { result } = renderHook(() => useClinicSearch());
    await waitFor(() => expect(result.current.loading).toBe(false));

    jest.useFakeTimers();

    act(() => {
      result.current.setQuery("paris");
    });
    expect(result.current.isQueryActive).toBe(false);

    act(() => {
      result.current.submit();
    });

    expect(result.current.isQueryActive).toBe(true);
    expect(result.current.results).toEqual([parisClinic]);
  });

  it("applies empty and short queries immediately without an extra API call", async () => {
    getClinics.mockResolvedValue(allClinics);

    const { result } = renderHook(() => useClinicSearch());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setQuery("p");
    });

    expect(result.current.isQueryActive).toBe(false);
    expect(result.current.results).toEqual(allClinics);

    act(() => {
      result.current.setQuery("");
    });

    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual(allClinics);
    expect(getClinics).toHaveBeenCalledTimes(1);
  });

  it("clears the query and cancels a pending debounced search", async () => {
    getClinics.mockResolvedValue(allClinics);

    const { result } = renderHook(() => useClinicSearch());
    await waitFor(() => expect(result.current.loading).toBe(false));

    jest.useFakeTimers();

    act(() => {
      result.current.setQuery("paris");
      result.current.clear();
    });

    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual(allClinics);

    act(() => {
      jest.advanceTimersByTime(CLINIC_SEARCH_DEBOUNCE_MS * 2);
    });

    expect(result.current.isQueryActive).toBe(false);
    expect(result.current.results).toEqual(allClinics);
  });
});
