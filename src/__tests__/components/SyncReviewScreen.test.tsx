/**
 * Tests for SyncReviewScreen component (issue #1142)
 *
 * Covers:
 * - Primary flow: pending items shown, "Start sync" available when online
 * - Empty state: no pending items
 * - Offline state: "Start sync" disabled, status banner visible
 * - Cancellation: per-item cancel removes the item
 * - Conflict status: "Start sync" blocked when conflicts exist, links shown
 * - Loading state: loading indicator while data is fetched
 * - Error state: error message when loading fails
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SyncReviewScreen from '@/components/SyncReviewScreen';
import { useSyncReview } from '@/hooks/useSyncReview';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/hooks/useSyncReview', () => ({
  useSyncReview: jest.fn(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: { pathname: string; query: { id: string } } | string;
    children: React.ReactNode;
  }) => {
    const resolvedHref =
      typeof href === 'string'
        ? href
        : href.pathname.replace('[id]', href.query.id);
    return (
      <a href={resolvedHref} {...props}>
        {children}
      </a>
    );
  },
}));

const mockedUseSyncReview = useSyncReview as jest.MockedFunction<typeof useSyncReview>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const createItem = (overrides = {}) => ({
  id: 1,
  ownerId: 'user-1',
  action: 'update' as const,
  endpoint: '/api/v1/pets/42',
  payload: { name: 'Buddy' },
  createdAt: 1_700_000_000_000,
  retryCount: 0,
  maxRetries: 3,
  idempotencyKey: 'key-1',
  ...overrides,
});

const createConflict = (overrides = {}) => ({
  conflictId: 'conflict-1',
  ownerId: 'user-1',
  queueItemId: 1,
  endpoint: '/api/v1/pets/42',
  idempotencyKey: 'key-1',
  localData: { name: 'Local' },
  serverData: { name: 'Server' },
  createdAt: 1_700_000_001_000,
  ...overrides,
});

const defaultState = {
  pendingItems: [],
  conflicts: [],
  isOnline: true,
  isLoading: false,
  error: null,
  cancelItem: jest.fn(),
  refresh: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SyncReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSyncReview.mockReturnValue({ ...defaultState });
  });

  // ── Heading ──────────────────────────────────────────────────────────────

  it('renders the main heading', () => {
    render(<SyncReviewScreen />);
    expect(
      screen.getByRole('heading', { name: /review queued changes/i }),
    ).toBeInTheDocument();
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  it('shows a loading indicator while data is loading', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      isLoading: true,
    });

    render(<SyncReviewScreen />);

    // Multiple role="status" elements may be present (status banner + loading indicator)
    const statusEls = screen.getAllByRole('status');
    const loadingEl = statusEls.find((el) => /loading queued changes/i.test(el.textContent ?? ''));
    expect(loadingEl).toBeTruthy();
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  it('shows empty-queue message when there are no pending items', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [],
    });

    render(<SyncReviewScreen />);

    expect(screen.getByText(/your queue is empty/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /start sync/i }),
    ).not.toBeInTheDocument();
  });

  // ── Primary flow: pending items + online ─────────────────────────────────

  it('lists each pending item with its action type and endpoint', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [
        createItem({ id: 1, action: 'update', endpoint: '/api/v1/pets/42' }),
        createItem({ id: 2, action: 'create', endpoint: '/api/v1/appointments/7', idempotencyKey: 'key-2' }),
        createItem({ id: 3, action: 'delete', endpoint: '/api/v1/records/99', idempotencyKey: 'key-3' }),
      ],
    });

    render(<SyncReviewScreen />);

    expect(screen.getByText(/3 pending changes/i)).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('/pets/42')).toBeInTheDocument();
    expect(screen.getByText('/appointments/7')).toBeInTheDocument();
    expect(screen.getByText('/records/99')).toBeInTheDocument();
  });

  it('shows "Start sync" button when online with pending items and no conflicts', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [createItem()],
      isOnline: true,
    });

    const onConfirmSync = jest.fn();
    render(<SyncReviewScreen onConfirmSync={onConfirmSync} />);

    const btn = screen.getByRole('button', { name: /start sync/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);
    expect(onConfirmSync).toHaveBeenCalledTimes(1);
  });

  // ── Online / offline status banner ────────────────────────────────────────

  it('shows "You are online" status banner when online', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      isOnline: true,
    });

    render(<SyncReviewScreen />);

    expect(screen.getByRole('status')).toHaveTextContent(/you are online/i);
  });

  it('shows "You are offline" status banner when offline', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      isOnline: false,
    });

    render(<SyncReviewScreen />);

    expect(screen.getByRole('status')).toHaveTextContent(/you are offline/i);
  });

  // ── Offline state: "Start sync" disabled ─────────────────────────────────

  it('disables "Start sync" and shows the button as disabled when offline', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [createItem()],
      isOnline: false,
    });

    render(<SyncReviewScreen onConfirmSync={jest.fn()} />);

    // There should be a disabled button (not the enabled one)
    const btn = screen.getByRole('button', { name: /start sync/i });
    expect(btn).toBeDisabled();
  });

  // ── Error state ───────────────────────────────────────────────────────────

  it('shows an error alert when the hook reports a load error', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      error: 'Unable to load pending sync changes.',
    });

    render(<SyncReviewScreen />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      /unable to load pending sync changes/i,
    );
  });

  // ── Cancellation ──────────────────────────────────────────────────────────

  it('renders a cancel button for each pending item with a descriptive accessible label', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [
        createItem({ id: 1, action: 'update', endpoint: '/api/v1/pets/42' }),
        createItem({ id: 2, action: 'create', endpoint: '/api/v1/appointments/7', idempotencyKey: 'key-2' }),
      ],
    });

    render(<SyncReviewScreen />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    expect(cancelButtons).toHaveLength(2);
    expect(cancelButtons[0]).toHaveAccessibleName(/cancel update on \/pets\/42/i);
    expect(cancelButtons[1]).toHaveAccessibleName(/cancel create on \/appointments\/7/i);
  });

  it('calls cancelItem with the correct id when the cancel button is clicked', async () => {
    const cancelItemMock = jest.fn().mockResolvedValue(undefined);
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [createItem({ id: 5 })],
      cancelItem: cancelItemMock,
    });

    render(<SyncReviewScreen />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(cancelItemMock).toHaveBeenCalledWith(5);
    });
  });

  it('disables the cancel button while the cancellation is in flight', async () => {
    let resolveCancel: () => void;
    const cancelItemMock = jest.fn(
      () => new Promise<void>((resolve) => { resolveCancel = resolve; }),
    );
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [createItem({ id: 7 })],
      cancelItem: cancelItemMock,
    });

    render(<SyncReviewScreen />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled(),
    );

    resolveCancel!();
  });

  // ── Conflict status ───────────────────────────────────────────────────────

  it('shows the unresolved conflict count with links when conflicts are present', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [createItem()],
      conflicts: [
        createConflict({ conflictId: 'conflict-1', endpoint: '/api/v1/pets/42' }),
        createConflict({ conflictId: 'conflict-2', endpoint: '/api/v1/pets/55', idempotencyKey: 'key-2' }),
      ],
      isOnline: true,
    });

    render(<SyncReviewScreen />);

    expect(
      screen.getByRole('heading', { name: /2 unresolved server conflicts/i }),
    ).toBeInTheDocument();

    const conflictLinks = screen.getAllByRole('link', { name: /resolve conflict/i });
    expect(conflictLinks).toHaveLength(2);
    expect(conflictLinks[0]).toHaveAttribute('href', '/sync/conflicts/conflict-1');
    expect(conflictLinks[1]).toHaveAttribute('href', '/sync/conflicts/conflict-2');
  });

  it('disables "Start sync" when unresolved conflicts exist', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [createItem()],
      conflicts: [createConflict()],
      isOnline: true,
    });

    render(<SyncReviewScreen onConfirmSync={jest.fn()} />);

    const btn = screen.getByRole('button', { name: /start sync/i });
    expect(btn).toBeDisabled();
  });

  it('does not show conflict section when there are no conflicts', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [createItem()],
      conflicts: [],
      isOnline: true,
    });

    render(<SyncReviewScreen />);

    expect(
      screen.queryByRole('heading', { name: /unresolved server conflict/i }),
    ).not.toBeInTheDocument();
  });

  // ── Retry count indicator ─────────────────────────────────────────────────

  it('shows retry attempt count for items that have been retried', () => {
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      pendingItems: [createItem({ retryCount: 2 })],
    });

    render(<SyncReviewScreen />);

    expect(screen.getByText(/2 retry attempts/i)).toBeInTheDocument();
  });

  // ── Refresh and dismiss callbacks ─────────────────────────────────────────

  it('calls refresh when the Refresh button is clicked', () => {
    const refreshMock = jest.fn();
    mockedUseSyncReview.mockReturnValue({
      ...defaultState,
      refresh: refreshMock,
    });

    render(<SyncReviewScreen />);

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the Back button is clicked', () => {
    const onDismiss = jest.fn();
    render(<SyncReviewScreen onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render the Back button when onDismiss is not provided', () => {
    render(<SyncReviewScreen />);
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });
});
