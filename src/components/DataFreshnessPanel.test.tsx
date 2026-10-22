/**
 * Tests for DataFreshnessPanel component
 *
 * Covers:
 *  - Renders all three categories with correct labels
 *  - Shows "Never refreshed" when lastRefreshedAt is null
 *  - Shows a relative timestamp when data is fresh
 *  - Shows "Stale" when data is older than the stale threshold
 *  - Shows error text (role=alert) on failure state
 *  - Refresh button calls onRefresh with the correct category
 *  - "Refresh all" button calls onRefreshAll
 *  - Buttons are disabled and show "Refreshing…" while isRefreshing=true
 *  - Keyboard focus: buttons are focusable
 *  - aria-label changes during refresh to aid screen-reader users
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DataFreshnessPanel, { DataFreshnessPanelProps } from '../DataFreshnessPanel';
import type { CategoryFreshness, DataCategory } from '@/hooks/useDataFreshness';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = 1_700_000_000_000; // fixed reference timestamp (ms)

function makeFreshness(overrides?: Partial<CategoryFreshness>): CategoryFreshness {
  return {
    lastRefreshedAt: null,
    isRefreshing: false,
    error: null,
    source: 'PetChain Test API',
    ...overrides,
  };
}

type FreshnessMap = Record<DataCategory, CategoryFreshness>;

function makeDefaultFreshness(overrides?: Partial<FreshnessMap>): FreshnessMap {
  return {
    profile: makeFreshness({ source: 'PetChain User API' }),
    medicalHistory: makeFreshness({ source: 'PetChain Medical Records API' }),
    emergency: makeFreshness({ source: 'PetChain Pet Emergency API' }),
    ...overrides,
  };
}

function renderPanel(props?: Partial<DataFreshnessPanelProps>) {
  const defaults: DataFreshnessPanelProps = {
    freshness: makeDefaultFreshness(),
    onRefresh: jest.fn(),
    onRefreshAll: jest.fn(),
    isAnyRefreshing: false,
  };
  return render(<DataFreshnessPanel {...defaults} {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataFreshnessPanel', () => {
  beforeAll(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering — categories and heading
  // -------------------------------------------------------------------------

  it('renders the "Data Freshness" heading', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: /data freshness/i })).toBeInTheDocument();
  });

  it('renders a row for each of the three data categories', () => {
    renderPanel();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Medical History')).toBeInTheDocument();
    expect(screen.getByText('Emergency')).toBeInTheDocument();
  });

  it('displays the source label for each category', () => {
    renderPanel();
    expect(screen.getByText('PetChain User API')).toBeInTheDocument();
    expect(screen.getByText('PetChain Medical Records API')).toBeInTheDocument();
    expect(screen.getByText('PetChain Pet Emergency API')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Empty / null state
  // -------------------------------------------------------------------------

  it('shows "Never refreshed" when lastRefreshedAt is null for all categories', () => {
    renderPanel();
    const neverTexts = screen.getAllByText('Never refreshed');
    expect(neverTexts.length).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Fresh data
  // -------------------------------------------------------------------------

  it('shows a relative timestamp when data was refreshed recently', () => {
    const recentIso = new Date(NOW - 2 * 60 * 1000).toISOString(); // 2 minutes ago
    renderPanel({
      freshness: makeDefaultFreshness({
        profile: makeFreshness({ lastRefreshedAt: recentIso }),
      }),
    });
    expect(screen.getByText(/updated 2m ago/i)).toBeInTheDocument();
  });

  it('shows "just now" for a very recent refresh', () => {
    const justNowIso = new Date(NOW - 2000).toISOString(); // 2 seconds ago
    renderPanel({
      freshness: makeDefaultFreshness({
        profile: makeFreshness({ lastRefreshedAt: justNowIso }),
      }),
    });
    expect(screen.getByText(/just now/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Stale state
  // -------------------------------------------------------------------------

  it('shows "Stale" label when data is older than 10 minutes', () => {
    const staleIso = new Date(NOW - 11 * 60 * 1000).toISOString(); // 11 minutes ago
    renderPanel({
      freshness: makeDefaultFreshness({
        profile: makeFreshness({ lastRefreshedAt: staleIso }),
      }),
    });
    expect(screen.getByText(/stale/i)).toBeInTheDocument();
  });

  it('does NOT show stale for data refreshed exactly at the threshold boundary', () => {
    // Exactly at threshold — not yet stale
    const boundaryIso = new Date(NOW - 10 * 60 * 1000).toISOString();
    renderPanel({
      freshness: makeDefaultFreshness({
        profile: makeFreshness({ lastRefreshedAt: boundaryIso }),
      }),
    });
    expect(screen.queryByText(/stale/i)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('shows an error message with role=alert when error is set', () => {
    renderPanel({
      freshness: makeDefaultFreshness({
        profile: makeFreshness({ error: 'Request timed out' }),
      }),
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Request timed out');
  });

  it('does not render an alert when error is null', () => {
    renderPanel();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Refresh button interactions
  // -------------------------------------------------------------------------

  it('calls onRefresh with "profile" when the Profile refresh button is clicked', () => {
    const onRefresh = jest.fn();
    renderPanel({ onRefresh });
    fireEvent.click(screen.getByRole('button', { name: /refresh profile data/i }));
    expect(onRefresh).toHaveBeenCalledWith('profile');
  });

  it('calls onRefresh with "medicalHistory" when the Medical History refresh button is clicked', () => {
    const onRefresh = jest.fn();
    renderPanel({ onRefresh });
    fireEvent.click(screen.getByRole('button', { name: /refresh medical history data/i }));
    expect(onRefresh).toHaveBeenCalledWith('medicalHistory');
  });

  it('calls onRefresh with "emergency" when the Emergency refresh button is clicked', () => {
    const onRefresh = jest.fn();
    renderPanel({ onRefresh });
    fireEvent.click(screen.getByRole('button', { name: /refresh emergency data/i }));
    expect(onRefresh).toHaveBeenCalledWith('emergency');
  });

  it('calls onRefreshAll when the "Refresh all" button is clicked', () => {
    const onRefreshAll = jest.fn();
    renderPanel({ onRefreshAll });
    fireEvent.click(screen.getByRole('button', { name: /refresh all dashboard data/i }));
    expect(onRefreshAll).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Refreshing state
  // -------------------------------------------------------------------------

  it('disables the refresh button and shows "Refreshing…" while isRefreshing=true', () => {
    renderPanel({
      freshness: makeDefaultFreshness({
        profile: makeFreshness({ isRefreshing: true }),
      }),
    });
    const btn = screen.getByRole('button', { name: /refreshing profile data/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Refreshing…');
  });

  it('disables "Refresh all" and updates its aria-label while isAnyRefreshing=true', () => {
    renderPanel({ isAnyRefreshing: true });
    const btn = screen.getByRole('button', { name: /refreshing all data/i });
    expect(btn).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Accessibility — keyboard focus and ARIA
  // -------------------------------------------------------------------------

  it('all Refresh buttons are focusable via keyboard', () => {
    renderPanel();
    const buttons = screen.getAllByRole('button', { name: /refresh/i });
    buttons.forEach((btn) => {
      btn.focus();
      expect(document.activeElement).toBe(btn);
    });
  });

  it('the section has an accessible heading for landmark navigation', () => {
    const { container } = renderPanel();
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    // The section is labelled by the heading via aria-labelledby
    const labelId = section!.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const heading = container.querySelector(`#${labelId}`);
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toMatch(/data freshness/i);
  });

  it('status text uses role=status so screen readers announce updates', () => {
    const recentIso = new Date(NOW - 30 * 1000).toISOString();
    renderPanel({
      freshness: makeDefaultFreshness({
        profile: makeFreshness({ lastRefreshedAt: recentIso }),
      }),
    });
    // At least one role="status" element should be in the document
    const statusEls = screen.getAllByRole('status');
    expect(statusEls.length).toBeGreaterThan(0);
  });
});
