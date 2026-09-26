import React from "react";
import { render, screen } from "@testing-library/react";
import StaleIndicator from "@/components/Clinics/StaleIndicator";

describe("StaleIndicator", () => {
  it("renders nothing when lastUpdated is null and not offline", () => {
    const { container } = render(
      <StaleIndicator lastUpdated={null} isOffline={false} isRefreshing={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows offline state with last-known timestamp", () => {
    const lastUpdated = new Date(Date.now() - 3 * 60 * 1000); // 3 min ago
    render(
      <StaleIndicator
        lastUpdated={lastUpdated}
        isOffline={true}
        isRefreshing={false}
      />,
    );
    expect(screen.getByText(/Offline/)).toBeInTheDocument();
    expect(screen.getByText(/last-known/)).toBeInTheDocument();
  });

  it("shows stale label when data is older than threshold", () => {
    const lastUpdated = new Date(Date.now() - 15 * 60 * 1000); // 15 min ago
    render(
      <StaleIndicator
        lastUpdated={lastUpdated}
        isOffline={false}
        isRefreshing={false}
      />,
    );
    expect(screen.getByText(/Stale/)).toBeInTheDocument();
  });

  it("does not show stale label when data is fresh", () => {
    const lastUpdated = new Date(Date.now() - 2 * 60 * 1000); // 2 min ago
    render(
      <StaleIndicator
        lastUpdated={lastUpdated}
        isOffline={false}
        isRefreshing={false}
      />,
    );
    expect(screen.queryByText(/Stale/)).not.toBeInTheDocument();
  });

  it("shows refresh spinner when refreshing", () => {
    const lastUpdated = new Date(Date.now() - 5 * 60 * 1000);
    render(
      <StaleIndicator
        lastUpdated={lastUpdated}
        isOffline={false}
        isRefreshing={true}
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows time-ago label for recent data", () => {
    const lastUpdated = new Date(Date.now() - 30 * 1000); // 30 sec ago
    render(
      <StaleIndicator
        lastUpdated={lastUpdated}
        isOffline={false}
        isRefreshing={false}
      />,
    );
    expect(screen.getByText(/just now/)).toBeInTheDocument();
  });

  it("shows hours-ago label for older data", () => {
    const lastUpdated = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
    render(
      <StaleIndicator
        lastUpdated={lastUpdated}
        isOffline={false}
        isRefreshing={false}
      />,
    );
    expect(screen.getByText(/3h ago/)).toBeInTheDocument();
  });
});
