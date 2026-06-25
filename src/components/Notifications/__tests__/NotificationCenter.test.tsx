import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationCenter from '@/components/Notifications/NotificationCenter';
import NotificationBell from '@/components/Notifications/NotificationBell';

// ─── Mock context ─────────────────────────────────────────────────────────────

const bellRef = React.createRef<HTMLButtonElement>();

// Mutable context holder — mutated in place so jest.mock closure always reads latest value
const ctx: Record<string, unknown> = {
  isCenterOpen: false,
  toggleCenter: jest.fn(),
  filteredNotifications: [],
  unreadCount: 0,
  activeFilter: 'ALL',
  setFilter: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  isLoading: false,
  notifications: [],
  toasts: [],
  preferences: {},
  isConnected: false,
  toast: jest.fn(),
  dismissToast: jest.fn(),
  updatePreferences: jest.fn(),
  requestBrowserPermission: jest.fn(),
  bellRef,
};

jest.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ctx,
}));

function setCtx(overrides: Record<string, unknown> = {}) {
  Object.assign(ctx, { toggleCenter: jest.fn() }, overrides);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationCenter focus management', () => {
  beforeEach(() => setCtx({ isCenterOpen: false }));

  it('moves focus into the panel when opened', () => {
    setCtx({ isCenterOpen: true });
    render(<NotificationCenter />);
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('renders nothing when closed', () => {
    const { container } = render(<NotificationCenter />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls toggleCenter when Escape is pressed', () => {
    setCtx({ isCenterOpen: true });
    render(<NotificationCenter />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect((ctx.toggleCenter as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('restores focus to bell button when panel closes', () => {
    const { rerender } = render(
      <>
        <button ref={bellRef as React.RefObject<HTMLButtonElement>} data-testid="bell" />
        <NotificationCenter />
      </>
    );

    setCtx({ isCenterOpen: true });
    rerender(
      <>
        <button ref={bellRef as React.RefObject<HTMLButtonElement>} data-testid="bell" />
        <NotificationCenter />
      </>
    );

    setCtx({ isCenterOpen: false });
    rerender(
      <>
        <button ref={bellRef as React.RefObject<HTMLButtonElement>} data-testid="bell" />
        <NotificationCenter />
      </>
    );

    expect(document.activeElement).toBe(screen.getByTestId('bell'));
  });

  it('does not focus bell when panel was never opened', () => {
    const { container } = render(<NotificationCenter />);
    expect(container).toBeEmptyDOMElement();
    expect(bellRef.current).toBeNull();
  });

  it('handles repeated open/close without errors', () => {
    const { rerender } = render(<NotificationCenter />);
    for (let i = 0; i < 5; i++) {
      setCtx({ isCenterOpen: true });
      expect(() => rerender(<NotificationCenter />)).not.toThrow();
      setCtx({ isCenterOpen: false });
      expect(() => rerender(<NotificationCenter />)).not.toThrow();
    }
  });
});

describe('NotificationBell', () => {
  beforeEach(() => setCtx({ isCenterOpen: false }));

  it('attaches bellRef to the button element', () => {
    render(<NotificationBell />);
    expect(bellRef.current).toBe(screen.getByRole('button'));
  });

  it('calls toggleCenter when clicked', () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button'));
    expect((ctx.toggleCenter as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});
