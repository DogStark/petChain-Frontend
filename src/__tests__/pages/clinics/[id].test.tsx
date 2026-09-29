import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AxiosError } from "axios";
import ClinicProfile from "@/pages/clinics/[id]";
import { clinicsAPI } from "@/lib/api/clinicsAPI";
import { Clinic } from "@/types/clinic";

const mockPush = jest.fn();

jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: { id: "clinic-1" },
    push: mockPush,
  }),
}));

jest.mock("@/components/Header", () => ({
  __esModule: true,
  default: () => <div data-testid="header" />,
}));

jest.mock("@/components/Clinics/StaffList", () => ({
  __esModule: true,
  default: () => <div data-testid="staff-list" />,
}));

jest.mock("@/components/Clinics/ServiceList", () => ({
  __esModule: true,
  default: () => <div data-testid="service-list" />,
}));

jest.mock("@/components/Clinics/ReviewSection", () => ({
  __esModule: true,
  default: () => <div data-testid="review-section" />,
}));

jest.mock("@/components/Clinics/LocationMap", () => ({
  __esModule: true,
  default: () => <div data-testid="location-map" />,
}));

jest.mock("@/components/Clinics/StaleIndicator", () => ({
  __esModule: true,
  default: function MockStaleIndicator({
    lastUpdated,
    isOffline,
    isRefreshing,
  }: {
    lastUpdated: Date | null;
    isOffline: boolean;
    isRefreshing: boolean;
  }) {
    return (
      <div data-testid="stale-indicator">
        {isOffline && <span data-testid="offline-badge">Offline</span>}
        {isRefreshing && <span data-testid="refreshing-badge">Refreshing</span>}
        {lastUpdated && (
          <span data-testid="last-updated">
            Last updated: {lastUpdated.toISOString()}
          </span>
        )}
      </div>
    );
  },
}));

jest.mock("@/lib/api/clinicsAPI", () => ({
  clinicsAPI: {
    getClinicById: jest.fn(),
  },
}));

const mockClinic: Clinic = {
  id: "clinic-1",
  name: "Pawfect Health Center",
  description: "Welcome to Pawfect Health Center.",
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
      name: "Consultation",
      description: "Comprehensive physical examination.",
      priceRange: "£55.00",
    },
  ],
  hours: [
    { day: "Monday", open: "08:30", close: "19:00", isClosed: false },
  ],
  staff: [],
};

function axiosErrorWithStatus(status: number): AxiosError {
  return new AxiosError("Request failed", undefined, undefined, undefined, {
    status,
    data: {},
    statusText: status === 404 ? "Not Found" : "Error",
    headers: {},
    config: {} as never,
  });
}

describe("ClinicProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders loading state while fetching clinic details", () => {
    (clinicsAPI.getClinicById as jest.Mock).mockReturnValue(
      new Promise(() => undefined),
    );
    render(<ClinicProfile />);
    expect(screen.getByText(/Loading clinic details/i)).toBeInTheDocument();
  });

  it("renders not-found state when API returns 404", async () => {
    (clinicsAPI.getClinicById as jest.Mock).mockRejectedValue(
      axiosErrorWithStatus(404),
    );
    render(<ClinicProfile />);
    await waitFor(() => {
      expect(screen.getByText(/Clinic not found/i)).toBeInTheDocument();
    });
  });

  it("renders error state with retry when API fails", async () => {
    (clinicsAPI.getClinicById as jest.Mock).mockRejectedValue(
      new Error("network error"),
    );
    render(<ClinicProfile />);
    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load clinic details/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders clinic detail when API returns a valid clinic", async () => {
    (clinicsAPI.getClinicById as jest.Mock).mockResolvedValue(mockClinic);
    render(<ClinicProfile />);
    await waitFor(() => {
      expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Welcome to Pawfect Health Center."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("service-list")).toBeInTheDocument();
  });

  it("shows stale indicator with last-updated time after data loads", async () => {
    (clinicsAPI.getClinicById as jest.Mock).mockResolvedValue(mockClinic);
    render(<ClinicProfile />);
    await waitFor(() => {
      expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
    });
    expect(screen.getByTestId("stale-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("last-updated")).toBeInTheDocument();
  });

  it("preserves existing content while background refresh is in flight", async () => {
    let resolveFirst: (value: Clinic) => void;
    const firstPromise = new Promise<Clinic>((resolve) => {
      resolveFirst = resolve;
    });
    (clinicsAPI.getClinicById as jest.Mock)
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({ ...mockClinic, name: "Updated Clinic Name" });

    render(<ClinicProfile />);

    // First load resolves
    await act(async () => {
      resolveFirst!(mockClinic);
    });

    await waitFor(() => {
      expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
    });

    // Trigger a background refresh (simulate focus event)
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    // Content should still show the original clinic name while refresh is in flight
    expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();

    // Resolve the background refresh
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // After refresh completes, updated name appears
    await waitFor(() => {
      expect(screen.getByText("Updated Clinic Name")).toBeInTheDocument();
    });
  });

  it("refreshes clinic data when the page regains focus", async () => {
    (clinicsAPI.getClinicById as jest.Mock).mockResolvedValue(mockClinic);
    render(<ClinicProfile />);

    await waitFor(() => {
      expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
    });

    const callCount = (clinicsAPI.getClinicById as jest.Mock).mock.calls.length;

    // Simulate window focus (foreground transition)
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    // API should be called again
    const newCallCount = (clinicsAPI.getClinicById as jest.Mock).mock.calls.length;
    expect(newCallCount).toBeGreaterThan(callCount);
  });

  it("refreshes clinic data when the document becomes visible", async () => {
    (clinicsAPI.getClinicById as jest.Mock).mockResolvedValue(mockClinic);
    render(<ClinicProfile />);

    await waitFor(() => {
      expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
    });

    const callCount = (clinicsAPI.getClinicById as jest.Mock).mock.calls.length;

    // Simulate visibility change (tab becomes visible)
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    const newCallCount = (clinicsAPI.getClinicById as jest.Mock).mock.calls.length;
    expect(newCallCount).toBeGreaterThan(callCount);
  });

  it("does not refresh when offline on focus/visibility change", async () => {
    (clinicsAPI.getClinicById as jest.Mock).mockResolvedValue(mockClinic);
    render(<ClinicProfile />);

    await waitFor(() => {
      expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
    });

    const callCount = (clinicsAPI.getClinicById as jest.Mock).mock.calls.length;

    // Simulate going offline
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });

    // Simulate focus while offline
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    // API should NOT be called again because we are offline
    expect(clinicsAPI.getClinicById).toHaveBeenCalledTimes(callCount);
  });

  it("shows offline banner and last-known timestamp when offline", async () => {
    (clinicsAPI.getClinicById as jest.Mock).mockResolvedValue(mockClinic);
    render(<ClinicProfile />);

    await waitFor(() => {
      expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
    });

    // Simulate going offline
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });

  it("refreshes on a bounded interval", async () => {
    (clinicsAPI.getClinicById as jest.Mock).mockResolvedValue(mockClinic);
    render(<ClinicProfile />);

    await waitFor(() => {
      expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
    });

    const callCount = (clinicsAPI.getClinicById as jest.Mock).mock.calls.length;

    // Advance past the refresh interval (5 minutes)
    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
    });

    // API should be called again due to interval
    const newCallCount = (clinicsAPI.getClinicById as jest.Mock).mock.calls.length;
    expect(newCallCount).toBeGreaterThan(callCount);
  });
});
