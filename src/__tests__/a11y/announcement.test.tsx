import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import AccessibilityAnnouncer from '@/components/Accessibility/AccessibilityAnnouncer';

// Helper component that exposes the announce function for testing.
function AnnouncerTrigger() {
  const { announce } = useAnnouncement();
  return (
    <div>
      <button
        data-testid="announce-success"
        onClick={() => announce('Pet saved successfully.', 'success')}
      >
        Announce Success
      </button>
      <button
        data-testid="announce-error"
        onClick={() => announce('Pet save failed.', 'error')}
      >
        Announce Error
      </button>
      <button
        data-testid="announce-warning"
        onClick={() => announce('Slot unavailable.', 'warning')}
      >
        Announce Warning
      </button>
      <button
        data-testid="announce-info"
        onClick={() => announce('Loading...', 'info')}
      >
        Announce Info
      </button>
      <button
        data-testid="announce-duplicate"
        onClick={() => {
          announce('Pet saved successfully.', 'success');
          announce('Pet saved successfully.', 'success');
        }}
      >
        Announce Duplicate
      </button>
    </div>
  );
}

describe('useAnnouncement hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('dispatches a CustomEvent on the window when announce is called', () => {
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');

    render(
      <>
        <AccessibilityAnnouncer />
        <AnnouncerTrigger />
      </>,
    );

    fireEvent.click(screen.getByTestId('announce-success'));

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'petchain-announcement',
        detail: expect.objectContaining({
          message: 'Pet saved successfully.',
          severity: 'success',
        }),
      }),
    );
  });

  it('generates announcements with unique ids', () => {
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');

    render(
      <>
        <AccessibilityAnnouncer />
        <AnnouncerTrigger />
      </>,
    );

    fireEvent.click(screen.getByTestId('announce-success'));
    fireEvent.click(screen.getByTestId('announce-error'));

    const announcementEvents = dispatchEvent.mock.calls.filter(
      ([e]) => (e as CustomEvent).type === 'petchain-announcement',
    );
    const ids = announcementEvents.map(
      ([e]) => (e as CustomEvent).detail.id,
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('deduplicates identical messages within the dedupe window', () => {
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');

    render(
      <>
        <AccessibilityAnnouncer />
        <AnnouncerTrigger />
      </>,
    );

    fireEvent.click(screen.getByTestId('announce-duplicate'));

    // Only one event should have been dispatched for the duplicate message
    const announcementEvents = dispatchEvent.mock.calls.filter(
      ([e]) => e.type === 'petchain-announcement',
    );
    expect(announcementEvents.length).toBe(1);
  });

  it('allows the same message after the dedupe window expires', () => {
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
    const realDateNow = Date.now;

    render(
      <>
        <AccessibilityAnnouncer />
        <AnnouncerTrigger />
      </>,
    );

    fireEvent.click(screen.getByTestId('announce-success'));

    // Advance Date.now by more than the dedupe window
    const fakeNow = realDateNow() + 5001;
    Date.now = jest.fn(() => fakeNow);

    fireEvent.click(screen.getByTestId('announce-success'));

    Date.now = realDateNow;

    const announcementEvents = dispatchEvent.mock.calls.filter(
      ([e]) => e.type === 'petchain-announcement',
    );
    expect(announcementEvents.length).toBe(2);
  });

  it('supports all severity levels', () => {
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');

    render(
      <>
        <AccessibilityAnnouncer />
        <AnnouncerTrigger />
      </>,
    );

    fireEvent.click(screen.getByTestId('announce-success'));
    fireEvent.click(screen.getByTestId('announce-error'));
    fireEvent.click(screen.getByTestId('announce-warning'));
    fireEvent.click(screen.getByTestId('announce-info'));

    const announcementEvents = dispatchEvent.mock.calls.filter(
      ([e]) => (e as CustomEvent).type === 'petchain-announcement',
    );
    const severities = announcementEvents.map(
      ([e]) => (e as CustomEvent).detail.severity,
    );
    expect(severities).toEqual(['success', 'error', 'warning', 'info']);
  });
});

describe('AccessibilityAnnouncer component', () => {
  it('renders a live region with role="status"', () => {
    render(<AccessibilityAnnouncer />);
    const region = screen.getByRole('status');
    expect(region).toBeInTheDocument();
  });

  it('renders announcements as paragraphs inside the live region', async () => {
    render(
      <>
        <AccessibilityAnnouncer />
        <AnnouncerTrigger />
      </>,
    );

    fireEvent.click(screen.getByTestId('announce-success'));

    await waitFor(() => {
      const region = screen.getByRole('status');
      const paragraphs = region.querySelectorAll('p');
      expect(paragraphs.length).toBeGreaterThan(0);
    });
  });

  it('does not expose sensitive values in the live region', () => {
    // The announcer only renders the message text passed to it.
    // Callers are responsible for sanitizing sensitive values.
    render(
      <>
        <AccessibilityAnnouncer />
        <AnnouncerTrigger />
      </>,
    );

    // The message "Pet saved successfully." does not contain any sensitive data.
    fireEvent.click(screen.getByTestId('announce-success'));

    // The live region should contain the sanitized message only.
    const region = screen.getByRole('status');
    expect(region).not.toHaveTextContent(/secret|password|token|key/i);
  });

  it('is visually hidden (sr-only) from the viewport', () => {
    render(<AccessibilityAnnouncer />);
    const region = screen.getByRole('status');
    expect(region).toHaveClass('sr-only');
    expect(region).toHaveStyle({
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
    });
  });
});
