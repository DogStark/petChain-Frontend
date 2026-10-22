import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import OfflineStorageBreakdown from './OfflineStorageBreakdown';
import { useStorageBreakdown } from '@/hooks/useStorageBreakdown';

jest.mock('@/hooks/useStorageBreakdown');

const cleanup = jest.fn();
const refresh = jest.fn();

const readyState = (overrides: Record<string, unknown> = {}) => ({
  status: 'ready',
  breakdown: {
    categories: [
      { id: 'cache', itemCount: 4, bytes: 2048, cleanableCount: 4 },
      { id: 'queuedChanges', itemCount: 3, bytes: 900, cleanableCount: 1 },
      { id: 'attachments', itemCount: 0, bytes: 0, cleanableCount: 0 },
    ],
    totalBytes: 2948,
    browserEstimate: null,
  },
  cleaningId: null,
  cleanupError: null,
  cleanup,
  refresh,
  ...overrides,
});

const mockHook = (state: Record<string, unknown>) =>
  (useStorageBreakdown as jest.Mock).mockReturnValue(state);

describe('OfflineStorageBreakdown', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    cleanup.mockResolvedValue({ id: 'cache', removed: 4 });
    mockHook(readyState());
  });

  it('shows count and size for each category', () => {
    render(<OfflineStorageBreakdown />);

    const cacheRow = screen.getByRole('row', { name: /cached data/i });
    expect(within(cacheRow).getByText('4')).toBeInTheDocument();
    expect(within(cacheRow).getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /queued changes/i })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /attachments/i })).toBeInTheDocument();
  });

  it('disables cleanup for categories with nothing safe to clear', () => {
    render(<OfflineStorageBreakdown />);

    expect(screen.getByRole('button', { name: /clear attachments/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /clear cached data/i })).toBeEnabled();
  });

  it('asks for confirmation, and cancelling removes nothing', async () => {
    const user = userEvent.setup();
    render(<OfflineStorageBreakdown />);

    await user.click(screen.getByRole('button', { name: /clear cached data/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(cleanup).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear cached data/i })).toHaveFocus();
  });

  it('cleans the category after confirmation and announces the result', async () => {
    const user = userEvent.setup();
    render(<OfflineStorageBreakdown />);

    await user.click(screen.getByRole('button', { name: /clear cached data/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(cleanup).toHaveBeenCalledWith('cache');
    expect(await screen.findByRole('status')).toHaveTextContent(/cleared 4 items/i);
  });

  it('warns that only failed queued changes are removed', async () => {
    const user = userEvent.setup();
    render(<OfflineStorageBreakdown />);

    await user.click(screen.getByRole('button', { name: /clear queued changes/i }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent(/failed every retry/i);
  });

  it('is operable from the keyboard', async () => {
    const user = userEvent.setup();
    render(<OfflineStorageBreakdown />);

    screen.getByRole('button', { name: /clear cached data/i }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();

    await user.keyboard('{Tab}{Enter}');

    expect(cleanup).toHaveBeenCalledWith('cache');
  });

  it('shows an empty state when nothing is stored', () => {
    mockHook(
      readyState({
        breakdown: {
          categories: [
            { id: 'cache', itemCount: 0, bytes: 0, cleanableCount: 0 },
            { id: 'queuedChanges', itemCount: 0, bytes: 0, cleanableCount: 0 },
            { id: 'attachments', itemCount: 0, bytes: 0, cleanableCount: 0 },
          ],
          totalBytes: 0,
          browserEstimate: null,
        },
      })
    );
    render(<OfflineStorageBreakdown />);

    expect(screen.getByText(/no offline data/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a sign-in prompt when unauthenticated', () => {
    mockHook(readyState({ status: 'unauthenticated', breakdown: null }));
    render(<OfflineStorageBreakdown />);

    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a retryable error when storage cannot be read', async () => {
    const user = userEvent.setup();
    mockHook(readyState({ status: 'error', breakdown: null }));
    render(<OfflineStorageBreakdown />);

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t read/i);
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(refresh).toHaveBeenCalled();
  });

  it('reports a failed cleanup without hiding the breakdown', () => {
    mockHook(readyState({ cleanupError: 'Cached data could not be cleared.' }));
    render(<OfflineStorageBreakdown />);

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be cleared/i);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<OfflineStorageBreakdown />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
