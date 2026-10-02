import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClinicDirectory from "@/pages/clinics/index";
import { clinicsAPI } from "@/lib/api/clinicsAPI";
import { CLINIC_SEARCH_DEBOUNCE_MS } from "@/hooks/useClinicSearch";
import { Clinic } from "@/types/clinic";

jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/Header", () => ({
  __esModule: true,
  default: () => <div data-testid="header" />,
}));

jest.mock("@/components/Clinics/ClinicCard", () => ({
  __esModule: true,
  default: ({ clinic }: { clinic: Clinic }) => (
    <div data-testid="clinic-card">{clinic.name}</div>
  ),
}));

jest.mock("@/lib/api/clinicsAPI", () => ({
  clinicsAPI: {
    getClinics: jest.fn(),
  },
}));

const getClinics = clinicsAPI.getClinics as jest.Mock;

const mockClinics: Clinic[] = [
  {
    id: "1",
    name: "Pawfect Health Center",
    description: "Premier veterinary clinic.",
    rating: 4.8,
    reviewCount: 156,
    locations: [
      {
        id: "1-1",
        name: "Main Branch",
        city: "London",
        address: "123 Pet Lane",
        phone: "020 1234 5678",
        email: "main@pawfect.com",
      },
    ],
    services: [
      {
        id: "s1",
        name: "General Checkup",
        description: "Routine health assessment",
        priceRange: "£50-£80",
      },
    ],
    hours: [],
    staff: [],
  },
  {
    id: "2",
    name: "Paris Vet Clinic",
    description: "Surgery and emergency care.",
    rating: 4.2,
    reviewCount: 89,
    locations: [
      {
        id: "2-1",
        name: "Paris Branch",
        city: "Paris",
        address: "5 Rue des Animaux",
        phone: "01 23 45 67 89",
        email: "hello@parisvet.com",
      },
    ],
    services: [
      {
        id: "s2",
        name: "Surgery",
        description: "Surgical procedures",
        priceRange: "£120-£400",
      },
    ],
    hours: [],
    staff: [],
  },
];

function renderLoadedDirectory(clinics: Clinic[] = mockClinics) {
  getClinics.mockResolvedValue(clinics);
  render(<ClinicDirectory />);
}

function getSearchInput() {
  return screen.getByRole("searchbox", { name: /search clinics/i });
}

describe("ClinicDirectory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders loading state while fetching clinics", () => {
    getClinics.mockReturnValue(new Promise(() => undefined));
    render(<ClinicDirectory />);
    expect(screen.getByText(/Loading clinics/i)).toBeInTheDocument();
    expect(screen.queryByText(/No clinics/i)).not.toBeInTheDocument();
  });

  it("renders empty state when API returns an empty array", async () => {
    getClinics.mockResolvedValue([]);
    render(<ClinicDirectory />);
    await waitFor(() => {
      expect(screen.getByText(/No clinics found/i)).toBeInTheDocument();
    });
  });

  it("renders error state with retry when API fails", async () => {
    getClinics.mockRejectedValue(new Error("network error"));
    render(<ClinicDirectory />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load clinics/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders ClinicCard for each clinic when API returns data", async () => {
    renderLoadedDirectory();
    await waitFor(() => {
      expect(screen.getAllByTestId("clinic-card")).toHaveLength(2);
    });
    expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
    expect(screen.getByText("Paris Vet Clinic")).toBeInTheDocument();
  });

  it("debounces typing and only applies the latest query", async () => {
    renderLoadedDirectory();
    await waitFor(() =>
      expect(screen.getAllByTestId("clinic-card")).toHaveLength(2),
    );

    jest.useFakeTimers();
    const input = getSearchInput();

    fireEvent.change(input, { target: { value: "lon" } });
    fireEvent.change(input, { target: { value: "paw" } });

    // The debounce window has not elapsed: nothing has been applied yet.
    expect(screen.getAllByTestId("clinic-card")).toHaveLength(2);
    expect(screen.getByText(/Searching/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(CLINIC_SEARCH_DEBOUNCE_MS);
    });

    expect(screen.getAllByTestId("clinic-card")).toHaveLength(1);
    expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
    expect(screen.queryByText("Paris Vet Clinic")).not.toBeInTheDocument();
    expect(screen.queryByText(/Searching/i)).not.toBeInTheDocument();
  });

  it("applies the search immediately on Enter without another API call", async () => {
    renderLoadedDirectory();
    await waitFor(() =>
      expect(screen.getAllByTestId("clinic-card")).toHaveLength(2),
    );

    jest.useFakeTimers();
    const input = getSearchInput();

    fireEvent.change(input, { target: { value: "paris" } });
    expect(screen.getAllByTestId("clinic-card")).toHaveLength(2);

    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getAllByTestId("clinic-card")).toHaveLength(1);
    expect(screen.getByText("Paris Vet Clinic")).toBeInTheDocument();
    expect(getClinics).toHaveBeenCalledTimes(1);
  });

  it("clears the query and cancels the pending search on Escape", async () => {
    renderLoadedDirectory();
    await waitFor(() =>
      expect(screen.getAllByTestId("clinic-card")).toHaveLength(2),
    );

    jest.useFakeTimers();
    const input = getSearchInput();

    fireEvent.change(input, { target: { value: "paris" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveValue("");
    expect(screen.getAllByTestId("clinic-card")).toHaveLength(2);

    act(() => {
      jest.advanceTimersByTime(CLINIC_SEARCH_DEBOUNCE_MS * 2);
    });

    // The cancelled debounce must not filter the list after the clear.
    expect(screen.getAllByTestId("clinic-card")).toHaveLength(2);
  });

  it("does not filter or refetch for queries shorter than the minimum", async () => {
    renderLoadedDirectory();
    await waitFor(() =>
      expect(screen.getAllByTestId("clinic-card")).toHaveLength(2),
    );

    fireEvent.change(getSearchInput(), { target: { value: "l" } });

    expect(screen.getAllByTestId("clinic-card")).toHaveLength(2);
    expect(
      screen.getByText(/Type at least 2 characters to search/i),
    ).toBeInTheDocument();
    expect(getClinics).toHaveBeenCalledTimes(1);
  });

  it("keeps the no-results state distinct from loading", async () => {
    renderLoadedDirectory();
    await waitFor(() =>
      expect(screen.getAllByTestId("clinic-card")).toHaveLength(2),
    );

    jest.useFakeTimers();
    const input = getSearchInput();

    fireEvent.change(input, { target: { value: "zzzz" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(
      screen.getByText(/No clinics match your search/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Loading clinics/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("clinic-card")).not.toBeInTheDocument();
  });
});
