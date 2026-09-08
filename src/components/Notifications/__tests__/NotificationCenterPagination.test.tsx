import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import NotificationCenter from '@/components/Notifications/NotificationCenter';
import type { AppNotification } from '@/types/notification';

// Mirrors PAGE_SIZE in NotificationCenter.tsx. Kept local so a change to the
// component's page size shows up here as a deliberate test failure.
const PAGE_SIZE = 20;

// ─── Mock context ─────────────────────────────────────────────────────────────

const bellRef = React.createRef<HTMLButtonElement>();

// Mutable context holder, mutated in place so the jest.mock closure always reads the latest value
const ctx: Record<string, unknown> = {};

jest.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ctx,
}));

function setCtx(overrides: Record<string, unknown> = {}) {
  // The provider derives filteredNotifications from notifications, so mirror it
  // unless a test sets both to exercise a filter that matches nothing.
  const mirror =
    'filteredNotifications' in overrides && !('notifications' in overrides)
      ? { notifications: overrides.filteredNotifications }
      : {};
  Object.assign(ctx, overrides, mirror);
}

function resetCtx(overrides: Record<string, unknown> = {}) {
  for (const key of Object.keys(ctx)) delete ctx[key];
  Object.assign(
    ctx,
    {
      isCenterOpen: true,
      toggleCenter: jest.fn(),
      filteredNotifications: [],
      unreadCount: 0,
      activeFilter: 'ALL',
      setFilter: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      isLoading: false,
      error: null,
      notifications: [],
      toasts: [],
      preferences: {},
      isConnected: false,
      toast: jest.fn(),
      dismissToast: jest.fn(),
      updatePreferences: jest.fn(),
      requestBrowserPermission: jest.fn(),
      bellRef,
    },
    overrides
  );
}

// ─── Fixtures: synthetic data only, no real pet/medical/contact values ────────

function makeNotifications(count: number, unreadLeading = 0): AppNotification[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `notif-${i}`,
    userId: 'test-user',
    title: `Test notification ${i}`,
    message: `Synthetic message body ${i}`,
    category: 'SYSTEM' as const,
    priority: 'normal' as const,
    isRead: i >= unreadLeading,
    readAt: null,
    actionUrl: null,
    metadata: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 12, 0, 0) - i * 60_000).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 0, 1, 12, 0, 0) - i * 60_000).toISOString(),
  }));
}

const rows = () => screen.queryAllByRole('listitem');
const loadMore = () => screen.queryByRole('button', { name: /load more/i });
const counter = () => screen.getByRole('dialog').querySelector('[aria-live]');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationCenter pagination', () => {
  beforeEach(() => resetCtx());

  it('renders at most one page of rows for a large list', () => {
    setCtx({ filteredNotifications: makeNotifications(120) });
    render(<NotificationCenter />);
    expect(rows()).toHaveLength(PAGE_SIZE);
  });

  it('offers a load more control when more notifications remain', () => {
    setCtx({ filteredNotifications: makeNotifications(120) });
    render(<NotificationCenter />);
    expect(loadMore()).toBeInTheDocument();
  });

  it('appends exactly one page per load more click', () => {
    setCtx({ filteredNotifications: makeNotifications(120) });
    render(<NotificationCenter />);

    fireEvent.click(loadMore()!);
    expect(rows()).toHaveLength(PAGE_SIZE * 2);

    fireEvent.click(loadMore()!);
    expect(rows()).toHaveLength(PAGE_SIZE * 3);
  });

  it('counts down only the notifications still outside the window', () => {
    setCtx({ filteredNotifications: makeNotifications(120) });
    render(<NotificationCenter />);
    expect(loadMore()).toHaveTextContent(/^Load more \(100\)$/);

    fireEvent.click(loadMore()!);
    expect(loadMore()).toHaveTextContent(/^Load more \(80\)$/);
  });

  it('keeps the header unread badge on the global count, not the rendered window', () => {
    setCtx({ filteredNotifications: makeNotifications(120, 42), unreadCount: 42 });
    render(<NotificationCenter />);
    expect(rows()).toHaveLength(PAGE_SIZE);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('reports how many notifications and unread items are outside the window', () => {
    setCtx({ filteredNotifications: makeNotifications(120, 42), unreadCount: 42 });
    render(<NotificationCenter />);
    expect(screen.getByText(/showing 20 of 120/i)).toBeInTheDocument();
    expect(screen.getByText(/22 unread not shown/i)).toBeInTheDocument();
  });

  it('announces the whole window counter politely, not just the changed number', () => {
    setCtx({ filteredNotifications: makeNotifications(120) });
    render(<NotificationCenter />);

    const region = screen.getByText(/showing 20 of 120/i);
    expect(region).toHaveAttribute('aria-live', 'polite');
    // React splits the sentence across text nodes, so without aria-atomic only
    // the changed fragment is read out.
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });
});

describe('NotificationCenter pagination boundaries', () => {
  beforeEach(() => resetCtx());

  it('renders the empty state and no load more control for zero notifications', () => {
    render(<NotificationCenter />);
    expect(rows()).toHaveLength(0);
    expect(screen.getByText('No notifications')).toBeInTheDocument();
    expect(loadMore()).not.toBeInTheDocument();
  });

  it('keeps the live region mounted but empty when there is nothing to count', () => {
    render(<NotificationCenter />);
    expect(screen.getByText('No notifications')).toBeInTheDocument();
    expect(screen.queryByText(/showing/i)).not.toBeInTheDocument();
    // Mounted up front: a live region inserted together with its first message
    // is not reliably announced.
    expect(counter()).toBeEmptyDOMElement();
  });

  it('renders no load more control at exactly one page', () => {
    setCtx({ filteredNotifications: makeNotifications(PAGE_SIZE) });
    render(<NotificationCenter />);
    expect(rows()).toHaveLength(PAGE_SIZE);
    expect(loadMore()).not.toBeInTheDocument();
  });

  it('renders a load more control at one over a page and exhausts it in one click', () => {
    setCtx({ filteredNotifications: makeNotifications(PAGE_SIZE + 1) });
    render(<NotificationCenter />);
    expect(rows()).toHaveLength(PAGE_SIZE);
    expect(loadMore()).toBeInTheDocument();

    fireEvent.click(loadMore()!);
    expect(rows()).toHaveLength(PAGE_SIZE + 1);
    expect(loadMore()).not.toBeInTheDocument();
  });
});

describe('NotificationCenter list semantics', () => {
  beforeEach(() => resetCtx());

  it('lets the list role own listitems and nothing else', () => {
    setCtx({ filteredNotifications: makeNotifications(120) });
    render(<NotificationCenter />);

    const list = screen.getByRole('list');
    expect(list.children).toHaveLength(PAGE_SIZE);
    for (const child of Array.from(list.children)) {
      expect(child).toHaveAttribute('role', 'listitem');
    }

    expect(within(list).queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    expect(loadMore()).toBeInTheDocument();
  });
});

describe('NotificationCenter loading and error states', () => {
  beforeEach(() => resetCtx());

  it('shows the loading state when nothing is cached yet', () => {
    setCtx({ isLoading: true });
    render(<NotificationCenter />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(rows()).toHaveLength(0);
  });

  it('keeps rendering a bounded window of cached rows while loading', () => {
    setCtx({ isLoading: true, filteredNotifications: makeNotifications(120) });
    render(<NotificationCenter />);
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(rows()).toHaveLength(PAGE_SIZE);
  });

  it('marks the list busy while a fetch runs behind cached rows', () => {
    setCtx({ isLoading: true, filteredNotifications: makeNotifications(30) });
    render(<NotificationCenter />);
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    expect(rows()).toHaveLength(PAGE_SIZE);
  });

  it('clears the busy flag when no fetch is in flight', () => {
    setCtx({ filteredNotifications: makeNotifications(30) });
    render(<NotificationCenter />);
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'false');
  });

  it('shows an error state in place of the list when nothing is cached', () => {
    setCtx({ error: 'Could not load the latest notifications.' });
    render(<NotificationCenter />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not load the latest notifications.');
    expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
  });

  it('shows a non-blocking error banner without hiding cached rows', () => {
    setCtx({
      error: 'Could not load the latest notifications.',
      filteredNotifications: makeNotifications(30),
    });
    render(<NotificationCenter />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the latest notifications.');
    expect(rows()).toHaveLength(PAGE_SIZE);
    expect(loadMore()).toBeInTheDocument();
  });

  it('shows the empty state, not the load error, when the filter matches nothing', () => {
    setCtx({
      error: 'Could not load the latest notifications.',
      notifications: makeNotifications(30),
      filteredNotifications: [],
      activeFilter: 'ALERT',
    });
    render(<NotificationCenter />);

    expect(screen.getByText('No notifications')).toBeInTheDocument();
    // The banner keeps the failure visible; only the full-page variant, which
    // carries the warning glyph, would replace the empty state.
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the latest notifications.');
    expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
  });
});

describe('NotificationCenter window stability', () => {
  beforeEach(() => resetCtx());

  it('resets the window when the category filter changes', () => {
    setCtx({ filteredNotifications: makeNotifications(120) });
    const { rerender } = render(<NotificationCenter />);

    fireEvent.click(loadMore()!);
    expect(rows()).toHaveLength(PAGE_SIZE * 2);

    setCtx({ activeFilter: 'SYSTEM' });
    rerender(<NotificationCenter />);
    expect(rows()).toHaveLength(PAGE_SIZE);
  });

  it('clamps the window during render, never committing the new list at the old count', () => {
    setCtx({ filteredNotifications: makeNotifications(120) });
    const { rerender } = render(<NotificationCenter />);

    fireEvent.click(loadMore()!);
    expect(rows()).toHaveLength(PAGE_SIZE * 2);

    const observer = new MutationObserver(() => {});
    observer.observe(screen.getByRole('dialog'), { childList: true, subtree: true });

    // A different set of rows, as a real filter change produces.
    const alerts = makeNotifications(120).map((n) => ({
      ...n,
      id: `alert-${n.id}`,
      category: 'ALERT' as const,
    }));
    setCtx({ activeFilter: 'ALERT', filteredNotifications: alerts });
    rerender(<NotificationCenter />);

    const addedRows = observer
      .takeRecords()
      .flatMap((r) => Array.from(r.addedNodes))
      .filter((n) => n instanceof HTMLElement && n.getAttribute('role') === 'listitem');
    observer.disconnect();

    expect(rows()).toHaveLength(PAGE_SIZE);
    // Resetting from a post-commit effect mounts PAGE_SIZE * 2 rows first.
    expect(addedRows).toHaveLength(PAGE_SIZE);
  });

  it('does not collapse the window when a new notification arrives', () => {
    const initial = makeNotifications(30);
    setCtx({ filteredNotifications: initial });
    const { rerender } = render(<NotificationCenter />);

    fireEvent.click(loadMore()!);
    expect(rows()).toHaveLength(30);

    const [incoming] = makeNotifications(1, 1);
    setCtx({ filteredNotifications: [{ ...incoming, id: 'notif-new' }, ...initial] });
    rerender(<NotificationCenter />);
    expect(rows()).toHaveLength(31);
  });

  it('does not collapse the window or reorder rows when one is marked read', () => {
    const initial = makeNotifications(30, 5);
    setCtx({ filteredNotifications: initial, unreadCount: 5 });
    const { rerender } = render(<NotificationCenter />);

    fireEvent.click(loadMore()!);
    expect(rows()).toHaveLength(30);

    // Reducer-shaped update: MARK_READ maps to a brand new array identity.
    setCtx({
      filteredNotifications: initial.map((n) =>
        n.id === 'notif-0' ? { ...n, isRead: true, readAt: '2026-01-01T12:00:00.000Z' } : n
      ),
      unreadCount: 4,
    });
    rerender(<NotificationCenter />);

    expect(rows()).toHaveLength(30);
    expect(within(rows()[0]).getByText('Test notification 0')).toBeInTheDocument();
    expect(within(rows()[29]).getByText('Test notification 29')).toBeInTheDocument();
  });
});

describe('NotificationCenter row activation', () => {
  beforeEach(() => resetCtx());

  it('keeps rows out of the tab order', () => {
    // Rows carry role="listitem" and no accessible name, so making them
    // focusable would expose an interactive control with a static role and
    // push the load more button behind a page of tab stops.
    setCtx({ filteredNotifications: makeNotifications(3, 3) });
    render(<NotificationCenter />);

    expect(rows()).toHaveLength(3);
    for (const row of rows()) expect(row).not.toHaveAttribute('tabindex');
  });

  it('leaves rows that are already read alone when clicked', () => {
    // A mixed fixture is required: an all-unread list cannot catch a regression
    // that fires markRead on rows that are already read.
    setCtx({ filteredNotifications: makeNotifications(4, 2) });
    render(<NotificationCenter />);
    const markRead = ctx.markRead as jest.Mock;

    fireEvent.click(rows()[2]);
    fireEvent.click(rows()[3]);
    expect(markRead).not.toHaveBeenCalled();

    fireEvent.click(rows()[0]);
    fireEvent.click(rows()[1]);
    expect(markRead).toHaveBeenCalledTimes(2);
    expect(markRead).toHaveBeenNthCalledWith(1, 'notif-0');
    expect(markRead).toHaveBeenNthCalledWith(2, 'notif-1');
  });

  it('does not mark the row read when its action link is activated', async () => {
    const [base] = makeNotifications(1, 1);
    setCtx({ filteredNotifications: [{ ...base, actionUrl: '#synthetic-target' }] });
    render(<NotificationCenter />);

    // Enter on a link fires a click, which without stopPropagation would reach
    // the row handler and mark the notification read behind the navigation.
    const link = within(rows()[0]).getByRole('link');
    link.focus();
    await userEvent.keyboard('{Enter}');

    expect(ctx.markRead as jest.Mock).not.toHaveBeenCalled();
  });
});
