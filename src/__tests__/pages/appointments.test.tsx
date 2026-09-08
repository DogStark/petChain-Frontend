import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AppointmentsPage from "@/pages/appointments";
import { appointmentsAPI } from "@/lib/api/appointmentsAPI";

jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/Header", () => ({
  __esModule: true,
  default: () => <div data-testid="header" />,
}));

jest.mock("@/components/Appointments/CalendarView", () => ({
  __esModule: true,
  default: () => <div data-testid="calendar" />,
}));

jest.mock("@/components/Appointments/BookingModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/Appointments/WaitlistManager", () => ({
  __esModule: true,
  default: () => <div data-testid="waitlist" />,
}));

jest.mock("@/components/Appointments/VetAvailabilityList", () => ({
  __esModule: true,
  default: () => <div data-testid="availability" />,
}));

jest.mock("@/lib/api/appointmentsAPI", () => ({
  appointmentsAPI: {
    getUpcomingAppointments: jest.fn(),
  },
}));

const mockUpcoming = [
  {
    appointment: {
      id: "1",
      pet_id: "p1",
      vet_id: "v1",
      appointment_type: "Checkup" as const,
      scheduled_at: "2024-01-15T10:00:00Z",
      duration: 30,
      status: "Scheduled" as const,
      reminder_sent: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    petName: "Bella",
    vetName: "Dr. Sarah Miller",
  },
];

describe("AppointmentsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state while fetching upcoming appointments", () => {
    (appointmentsAPI.getUpcomingAppointments as jest.Mock).mockReturnValue(
      new Promise(() => undefined),
    );
    render(<AppointmentsPage />);
    expect(
      screen.getByText(/Loading upcoming appointments/i),
    ).toBeInTheDocument();
  });

  it("renders empty state when API returns an empty array", async () => {
    (appointmentsAPI.getUpcomingAppointments as jest.Mock).mockResolvedValue(
      [],
    );
    render(<AppointmentsPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/No upcoming appointments/i),
      ).toBeInTheDocument();
    });
  });

  it("renders error state with retry when API fails", async () => {
    (appointmentsAPI.getUpcomingAppointments as jest.Mock).mockRejectedValue(
      new Error("network error"),
    );
    render(<AppointmentsPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load upcoming appointments/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders appointments list when API returns data", async () => {
    (appointmentsAPI.getUpcomingAppointments as jest.Mock).mockResolvedValue(
      mockUpcoming,
    );
    render(<AppointmentsPage />);
    await waitFor(() => {
      expect(screen.getByText("Bella")).toBeInTheDocument();
    });
    expect(screen.getByText("Dr. Sarah Miller")).toBeInTheDocument();
    expect(screen.getByText("Checkup")).toBeInTheDocument();
  });
});
