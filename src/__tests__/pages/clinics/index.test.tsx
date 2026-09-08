import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ClinicDirectory from "@/pages/clinics/index";
import { clinicsAPI } from "@/lib/api/clinicsAPI";
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
];

describe("ClinicDirectory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state while fetching clinics", () => {
    (clinicsAPI.getClinics as jest.Mock).mockReturnValue(
      new Promise(() => undefined),
    );
    render(<ClinicDirectory />);
    expect(screen.getByText(/Loading clinics/i)).toBeInTheDocument();
  });

  it("renders empty state when API returns an empty array", async () => {
    (clinicsAPI.getClinics as jest.Mock).mockResolvedValue([]);
    render(<ClinicDirectory />);
    await waitFor(() => {
      expect(screen.getByText(/No clinics found/i)).toBeInTheDocument();
    });
  });

  it("renders error state with retry when API fails", async () => {
    (clinicsAPI.getClinics as jest.Mock).mockRejectedValue(
      new Error("network error"),
    );
    render(<ClinicDirectory />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load clinics/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders ClinicCard for each clinic when API returns data", async () => {
    (clinicsAPI.getClinics as jest.Mock).mockResolvedValue(mockClinics);
    render(<ClinicDirectory />);
    await waitFor(() => {
      expect(screen.getByTestId("clinic-card")).toBeInTheDocument();
    });
    expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
  });
});
