import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LocationMap from "@/components/Clinics/LocationMap";
import { ClinicLocation } from "@/types/clinic";

const mockLocations: ClinicLocation[] = [
  {
    id: "loc-1",
    name: "Pawfect Health Center",
    address: "123 Pet Lane",
    city: "London",
    phone: "020 1234 5678",
    email: "info@pawfect.com",
    coordinates: { lat: 51.5074, lng: -0.1278 },
  },
  {
    id: "loc-2",
    name: "Animal Care Clinic",
    address: "456 Vet Street",
    city: "London",
    phone: "020 9876 5432",
    email: "contact@animalcare.com",
    coordinates: { lat: 51.5155, lng: -0.1415 },
  },
];

const mockLocationsWithoutCoords: ClinicLocation[] = [
  {
    id: "loc-3",
    name: "Remote Clinic",
    address: "789 Rural Road",
    city: "Countryside",
    phone: "0123 456 789",
    email: "remote@clinic.com",
  },
];

const mixedLocations: ClinicLocation[] = [...mockLocations, ...mockLocationsWithoutCoords];

function setupGeolocationAvailable() {
  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: jest.fn(),
      watchPosition: jest.fn(),
      clearWatch: jest.fn(),
    },
    writable: true,
    configurable: true,
  });
}

function setupGeolocationUnavailable() {
  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: jest.fn(
        (
          _success: unknown,
          error: (err: {
            code: number;
            PERMISSION_DENIED: number;
            POSITION_UNAVAILABLE: number;
            TIMEOUT: number;
            message: string;
          }) => void
        ) => {
          error({
            code: 2,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: "Position unavailable",
          });
        }
      ),
      watchPosition: jest.fn(),
      clearWatch: jest.fn(),
    },
    writable: true,
    configurable: true,
  });
}

function setupGeolocationNotSupported() {
  Object.defineProperty(navigator, "geolocation", {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

function setupGeolocationPermissionDenied() {
  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: jest.fn(
        (
          _success: unknown,
          error: (err: {
            code: number;
            PERMISSION_DENIED: number;
            POSITION_UNAVAILABLE: number;
            TIMEOUT: number;
            message: string;
          }) => void
        ) => {
          error({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: "Permission denied",
          });
        }
      ),
      watchPosition: jest.fn(),
      clearWatch: jest.fn(),
    },
    writable: true,
    configurable: true,
  });
}

async function advanceToLoaded() {
  jest.advanceTimersByTime(1500);
  await waitFor(() => {
    expect(screen.queryByText(/loading map/i)).not.toBeInTheDocument();
  });
}

describe("LocationMap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    setupGeolocationAvailable();

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Loading State", () => {
    it("shows loading indicator initially", () => {
      render(<LocationMap locations={mockLocations} />);
      expect(
        screen.getByRole("status", { name: /map loading/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/loading map/i)).toBeInTheDocument();
    });

    it("transitions to loaded state after timeout", async () => {
      render(<LocationMap locations={mockLocations} />);
      expect(
        screen.getByRole("status", { name: /map loading/i })
      ).toBeInTheDocument();
      await advanceToLoaded();
      expect(
        screen.queryByRole("status", { name: /map loading/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Loaded State", () => {
    it("renders clinic details list when loaded", async () => {
      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();
      expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
      expect(screen.getByText("Animal Care Clinic")).toBeInTheDocument();
      expect(screen.getByText("020 1234 5678")).toBeInTheDocument();
      expect(screen.getByText("info@pawfect.com")).toBeInTheDocument();
    });

    it("shows map bottom info bar when loaded", async () => {
      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();
      expect(screen.getByText("All Locations")).toBeInTheDocument();
    });

    it("shows empty state when no locations provided", async () => {
      render(<LocationMap locations={[]} />);
      await advanceToLoaded();
      expect(
        screen.getByText(/no clinic locations available/i)
      ).toBeInTheDocument();
    });

    it("shows Find My Location button when loaded", async () => {
      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();
      expect(
        screen.getByRole("button", { name: /find my location/i })
      ).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error state when geolocation errors", async () => {
      setupGeolocationUnavailable();

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const locateBtn = screen.getByRole("button", {
        name: /find my location/i,
      });
      fireEvent.click(locateBtn);

      await waitFor(() => {
        expect(screen.getByText(/map unavailable/i)).toBeInTheDocument();
      });
      expect(
        screen.getByText(/the map could not be loaded/i)
      ).toBeInTheDocument();
    });

    it("shows retry button in error state", async () => {
      setupGeolocationUnavailable();

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const locateBtn = screen.getByRole("button", {
        name: /find my location/i,
      });
      fireEvent.click(locateBtn);

      await waitFor(() => {
        expect(screen.getByText(/map unavailable/i)).toBeInTheDocument();
      });
      expect(
        screen.getByRole("button", { name: /try again/i })
      ).toBeInTheDocument();
    });
  });

  describe("No Geolocation State", () => {
    it("shows no-geolocation state when geolocation not supported", async () => {
      setupGeolocationNotSupported();

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      expect(screen.getByText(/location not supported/i)).toBeInTheDocument();
    });

    it("shows refresh button in no-geolocation state", async () => {
      setupGeolocationNotSupported();

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      expect(
        screen.getByRole("button", { name: /refresh map/i })
      ).toBeInTheDocument();
    });

    it("shows denied state when permission denied", async () => {
      setupGeolocationPermissionDenied();

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const locateBtn = screen.getByRole("button", {
        name: /find my location/i,
      });
      fireEvent.click(locateBtn);

      await waitFor(() => {
        expect(screen.getByText(/location access denied/i)).toBeInTheDocument();
      });
      expect(
        screen.getByText(/you denied location access/i)
      ).toBeInTheDocument();
    });
  });

  describe("Location Interactions", () => {
    it("expands location details when list item clicked", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const listButton = screen.getByRole("button", {
        name: /pawfect health center/i,
      });
      await user.click(listButton);

      expect(
        screen.getByRole("region", {
          name: /additional details for pawfect health center/i,
        })
      ).toBeInTheDocument();
    });

    it("shows navigate link when expanded", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const listButton = screen.getByRole("button", {
        name: /pawfect health center/i,
      });
      await user.click(listButton);

      expect(
        screen.getByRole("link", {
          name: /navigate to pawfect health center/i,
        })
      ).toBeInTheDocument();
    });

    it("toggles location details when clicked again", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const listButton = screen.getByRole("button", {
        name: /pawfect health center/i,
      });

      await user.click(listButton);
      expect(listButton).toHaveAttribute("aria-expanded", "true");
      const detailsRegion = document.getElementById("location-details-loc-1");
      expect(detailsRegion).not.toHaveClass("hidden");

      await user.click(listButton);
      expect(listButton).toHaveAttribute("aria-expanded", "false");
      expect(detailsRegion).toHaveClass("hidden");
    });

    it("clicking one location then another", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const pawfectBtn = screen.getByRole("button", {
        name: /pawfect health center/i,
      });
      const animalBtn = screen.getByRole("button", {
        name: /animal care clinic/i,
      });

      await user.click(pawfectBtn);
      expect(
        screen.getByRole("link", {
          name: /navigate to pawfect health center/i,
        })
      ).toBeInTheDocument();

      await user.click(animalBtn);
      expect(
        screen.getByRole("link", {
          name: /navigate to animal care clinic/i,
        })
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels for regions", () => {
      render(<LocationMap locations={mockLocations} />);

      expect(
        screen.getByRole("region", { name: /clinic location map/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("region", { name: /clinic location details/i })
      ).toBeInTheDocument();
    });

    it("supports keyboard Enter on list items", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const listButton = screen.getByRole("button", {
        name: /pawfect health center/i,
      });
      listButton.focus();

      await user.keyboard("{Enter}");
      expect(
        screen.getByRole("region", {
          name: /additional details for pawfect health center/i,
        })
      ).toBeInTheDocument();
    });

    it("supports keyboard Space on list items", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const listButton = screen.getByRole("button", {
        name: /pawfect health center/i,
      });
      listButton.focus();

      await user.keyboard(" ");
      expect(
        screen.getByRole("region", {
          name: /additional details for pawfect health center/i,
        })
      ).toBeInTheDocument();
    });

    it("has proper aria-expanded on list items", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const listButton = screen.getByRole("button", {
        name: /pawfect health center/i,
      });
      expect(listButton).toHaveAttribute("aria-expanded", "false");

      await user.click(listButton);
      expect(listButton).toHaveAttribute("aria-expanded", "true");
    });

    it("has proper aria-controls on list items", async () => {
      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const listButton = screen.getByRole("button", {
        name: /pawfect health center/i,
      });
      expect(listButton).toHaveAttribute(
        "aria-controls",
        "location-details-loc-1"
      );
    });
  });

  describe("Mixed Locations", () => {
    it("shows locations without coordinates in the list", async () => {
      render(<LocationMap locations={mixedLocations} />);
      await advanceToLoaded();

      expect(screen.getByText("Remote Clinic")).toBeInTheDocument();
      expect(
        screen.getByText(/1 location without map coordinates/i)
      ).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("renders properly on mobile viewports", async () => {
      global.innerWidth = 375;
      global.innerHeight = 667;
      global.dispatchEvent(new Event("resize"));

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      expect(screen.getByText("Pawfect Health Center")).toBeInTheDocument();
      expect(screen.getByText("Animal Care Clinic")).toBeInTheDocument();
    });
  });

  describe("External Links", () => {
    it("opens Google Maps in new tab for locations with coordinates", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const listButton = screen.getByRole("button", {
        name: /pawfect health center/i,
      });
      await user.click(listButton);

      const navigateLink = screen.getByRole("link", {
        name: /navigate to pawfect health center/i,
      });
      expect(navigateLink).toHaveAttribute("target", "_blank");
      expect(navigateLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(navigateLink.href).toContain("google.com/maps");
    });

    it("opens Google Maps with address for locations without coordinates", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<LocationMap locations={mockLocationsWithoutCoords} />);
      await advanceToLoaded();

      const listButton = screen.getByRole("button", {
        name: /remote clinic/i,
      });
      await user.click(listButton);

      const navigateLink = screen.getByRole("link", {
        name: /navigate to remote clinic/i,
      });
      expect(navigateLink.href).toContain("google.com/maps");
    });

    it("creates tel: link for call button", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const listButton = screen.getByRole("button", {
        name: /pawfect health center/i,
      });
      await user.click(listButton);

      const callLink = screen.getByRole("link", {
        name: /call pawfect health center$/i,
      });
      expect(callLink.href).toContain("tel:");
    });

    it("creates mailto: link for email", async () => {
      render(<LocationMap locations={mockLocations} />);
      await advanceToLoaded();

      const emailLink = screen.getByRole("link", {
        name: /email pawfect health center/i,
      });
      expect(emailLink.href).toContain("mailto:info@pawfect.com");
    });
  });
});
