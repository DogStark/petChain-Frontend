import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SyncConflictPage from '@/pages/sync/conflicts/[id]';
import { syncManager } from '@/lib/offline/syncManager';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ query: { id: '17' }, isReady: true }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/components/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/offline/syncManager', () => ({
  syncManager: {
    getConflict: jest.fn(),
    resolveConflict: jest.fn(),
  },
}));

const conflictSnapshot = {
  conflictId: '17',
  ownerId: 'user-1',
  queueItemId: 17,
  endpoint: '/pets/3',
  idempotencyKey: 'request-17',
  localData: { name: 'Saved name', phone: '111-1111' },
  serverData: { name: 'Server name', phone: '222-2222' },
  createdAt: 1_800_000_000_000,
};

const mockedSyncManager = syncManager as jest.Mocked<typeof syncManager>;

describe('SyncConflictPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('compares each field and submits explicitly selected values', async () => {
    mockedSyncManager.getConflict.mockResolvedValue(conflictSnapshot);
    mockedSyncManager.resolveConflict.mockResolvedValue(undefined);

    render(<SyncConflictPage />);

    expect(await screen.findByText('Field-by-field comparison')).toBeInTheDocument();
    expect(screen.getByText('Saved name')).toBeInTheDocument();
    expect(screen.getByText('Server name')).toBeInTheDocument();
    expect(screen.getAllByRole('group')).toHaveLength(2);

    fireEvent.click(screen.getByRole('radio', { name: /saved version.*saved name/i }));
    fireEvent.click(screen.getByRole('button', { name: /save selected values/i }));

    await waitFor(() => {
      expect(mockedSyncManager.resolveConflict).toHaveBeenCalledWith(
        '17',
        {
          name: 'Saved name',
          phone: '222-2222',
        },
        'user-1',
        undefined,
      );
    });
    expect(await screen.findByText('Conflict resolved')).toBeInTheDocument();
  });

  it('reports a backend authorization denial and keeps the comparison available', async () => {
    mockedSyncManager.getConflict.mockResolvedValue(conflictSnapshot);
    mockedSyncManager.resolveConflict.mockRejectedValue(
      new Error('The server did not accept this resolution (HTTP 403).'),
    );

    render(<SyncConflictPage />);

    fireEvent.click(
      await screen.findByRole('button', { name: /save selected values/i }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/HTTP 403/i);
    expect(screen.getByText('Saved name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save selected values/i })).toBeEnabled();
  });

  it('shows an empty comparison state when the server provides no fields', async () => {
    mockedSyncManager.getConflict.mockResolvedValue({
      ...conflictSnapshot,
      localData: {},
      serverData: {},
    });

    render(<SyncConflictPage />);

    expect(await screen.findByText(/no comparable fields/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save selected values/i })).not.toBeInTheDocument();
  });

  it('explains when the conflict is missing or already resolved', async () => {
    mockedSyncManager.getConflict.mockResolvedValue(null);

    render(<SyncConflictPage />);

    expect(await screen.findByText(/conflict is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save selected values/i })).not.toBeInTheDocument();
  });

  it('does not reveal a locally saved conflict owned by another account', async () => {
    mockedSyncManager.getConflict.mockResolvedValue({
      ...conflictSnapshot,
      ownerId: 'different-user',
    });

    render(<SyncConflictPage />);

    expect(await screen.findByText(/conflict is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText('Saved name')).not.toBeInTheDocument();
  });
});
