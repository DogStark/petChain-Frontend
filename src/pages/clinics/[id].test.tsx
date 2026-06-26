import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import ClinicProfile from "./[id]";
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
});
