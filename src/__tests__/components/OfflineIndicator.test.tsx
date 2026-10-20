import React from 'react';
import { render, screen } from '@testing-library/react';
import OfflineIndicator from '@/components/OfflineIndicator';
import { useOffline } from '@/hooks/useOffline';

jest.mock('@/hooks/useOffline', () => ({ useOffline: jest.fn() }));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: { pathname: string; query: { id: string } };
    children: React.ReactNode;
  }) => (
    <a href={href.pathname.replace('[id]', href.query.id)} {...props}>
      {children}
    </a>
  ),
}));

const mockedUseOffline = useOffline as jest.MockedFunction<typeof useOffline>;

describe('OfflineIndicator conflict links', () => {
  it('shows a count matching the unresolved server conflicts and deep-links each comparison', () => {
    mockedUseOffline.mockReturnValue({
      isOnline: true,
      syncStatus: 'conflict',
      pendingSyncCount: 4,
      unresolvedConflictIds: ['12', '37'],
      lastSyncTime: null,
      syncDetails: '2 unresolved conflict(s)',
      triggerSync: jest.fn(),
      getCached: jest.fn(),
      setCached: jest.fn(),
      queueAction: jest.fn(),
      clearOldCache: jest.fn(),
    });

    render(<OfflineIndicator />);

    expect(screen.getByText('2 unresolved server conflicts')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /compare conflict/i })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Compare conflict 1' })).toHaveAttribute(
      'href',
      '/sync/conflicts/12',
    );
    expect(screen.getByRole('link', { name: 'Compare conflict 2' })).toHaveAttribute(
      'href',
      '/sync/conflicts/37',
    );
  });

  it('does not render a conflict count or stale deep links when no conflicts remain', () => {
    mockedUseOffline.mockReturnValue({
      isOnline: true,
      syncStatus: 'idle',
      pendingSyncCount: 0,
      unresolvedConflictIds: [],
      lastSyncTime: null,
      syncDetails: undefined,
      triggerSync: jest.fn(),
      getCached: jest.fn(),
      setCached: jest.fn(),
      queueAction: jest.fn(),
      clearOldCache: jest.fn(),
    });

    render(<OfflineIndicator />);

    expect(screen.queryByRole('navigation', { name: /unresolved server conflicts/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/unresolved server conflict/i)).not.toBeInTheDocument();
  });

  it('announces a single conflict even when the visual label is hidden', () => {
    mockedUseOffline.mockReturnValue({
      isOnline: true,
      syncStatus: 'conflict',
      pendingSyncCount: 1,
      unresolvedConflictIds: ['51'],
      lastSyncTime: null,
      syncDetails: undefined,
      triggerSync: jest.fn(),
      getCached: jest.fn(),
      setCached: jest.fn(),
      queueAction: jest.fn(),
      clearOldCache: jest.fn(),
    });

    render(<OfflineIndicator showLabel={false} />);

    expect(screen.getByRole('status')).toHaveTextContent('1 unresolved server conflict');
    expect(screen.getByRole('link', { name: 'Compare conflict 1' })).toHaveAttribute(
      'href',
      '/sync/conflicts/51',
    );
  });

  it('keeps conflict count and comparison links available while offline', () => {
    mockedUseOffline.mockReturnValue({
      isOnline: false,
      syncStatus: 'idle',
      pendingSyncCount: 3,
      unresolvedConflictIds: ['91', '92'],
      lastSyncTime: null,
      syncDetails: undefined,
      triggerSync: jest.fn(),
      getCached: jest.fn(),
      setCached: jest.fn(),
      queueAction: jest.fn(),
      clearOldCache: jest.fn(),
    });

    render(<OfflineIndicator />);

    expect(screen.getByRole('status')).toHaveTextContent(
      '2 unresolved server conflicts',
    );
    expect(screen.getAllByRole('link', { name: /compare conflict/i })).toHaveLength(2);
  });
});
