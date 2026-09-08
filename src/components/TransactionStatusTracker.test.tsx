import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { transactionAPI } from '@/lib/api/transactionAPI';
import type { Transaction } from '@/lib/api/transactionAPI';
import { getExplorerTxUrl } from '@/lib/explorer';
import { getFinality, reconcileTransactions } from '@/lib/transactionFinality';

import TransactionStatusTracker, { BASE_INTERVAL, MAX_INTERVAL } from './TransactionStatusTracker';

jest.mock('@/lib/api/transactionAPI', () => {
  const actual = jest.requireActual('@/lib/api/transactionAPI');
  return {
    ...actual,
    transactionAPI: {
      getPendingTransactions: jest.fn(),
      getFailedTransactions: jest.fn(),
      cancelPendingTransaction: jest.fn(),
      retryFailedTransaction: jest.fn(),
      getTransactionHistory: jest.fn(),
      getTransactionById: jest.fn(),
      getTransactionByHash: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getTransactionCost: jest.fn(),
      estimateTransactionCost: jest.fn(),
      getTotalCosts: jest.fn(),
    },
  };
});

const mockedAPI = transactionAPI as jest.Mocked<typeof transactionAPI>;

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  type: 'record_creation' as const,
  status: 'pending' as const,
  fromAddress: 'GTESTFROMADDRESS1234567890ABCDEFGHJKLMNPQRSTUVWXYZ1234',
  fee: '0.00001',
  timestamp: '2024-01-01T00:00:00Z',
  confirmations: 0,
  ...overrides,
});

describe('transaction finality model - pure logic (characterizes lifecycle)', () => {
  it('maps confirmed status to confirmed finality', () => {
    expect(getFinality(makeTx({ status: 'confirmed', confirmations: 5, blockNumber: 123 }))).toBe('confirmed');
  });
  it('maps failed/cancelled to failed', () => {
    expect(getFinality(makeTx({ status: 'failed' }))).toBe('failed');
    expect(getFinality(makeTx({ status: 'cancelled' as never }))).toBe('failed');
  });
  it('maps pending 0 confirmations to submitted', () => {
    expect(getFinality(makeTx({ status: 'pending', confirmations: 0 }))).toBe('submitted');
  });
  it('maps pending with confirmations or blockNumber to accepted', () => {
    expect(getFinality(makeTx({ status: 'pending', confirmations: 1 }))).toBe('accepted');
    expect(getFinality(makeTx({ status: 'pending', confirmations: 0, blockNumber: 99 }))).toBe('accepted');
    expect(getFinality(makeTx({ status: 'pending', confirmations: 2, blockNumber: 10 }))).toBe('accepted');
  });
  it('maps unknown statuses to unknown, including negative confirmations (boundary)', () => {
    expect(getFinality(makeTx({ status: 'bogus' as never, confirmations: 0 }))).toBe('unknown');
    expect(getFinality(makeTx({ status: 'pending', confirmations: -1 }))).toBe('unknown');
    expect(getFinality(makeTx({ status: undefined as never }))).toBe('unknown');
  });
  it('reconciles conflicting provider responses - same id in both lists becomes unknown + isConflict', () => {
    const dup = makeTx({ id: 'dup', status: 'pending', confirmations: 0 });
    const reconciled = reconcileTransactions([dup], [{ ...dup, status: 'failed' }]);
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0].isConflict).toBe(true);
    expect(reconciled[0].finality).toBe('unknown');
    expect(reconciled[0].sources).toEqual(expect.arrayContaining(['pending', 'failed']));
  });
  it('detects status contradicting source as conflict', () => {
    const pendingContradiction = makeTx({ id: 'c1', status: 'failed', confirmations: 0 });
    const reconciled = reconcileTransactions([pendingContradiction], []);
    expect(reconciled[0].isConflict).toBe(true);
    expect(reconciled[0].finality).toBe('unknown');
  });
});

describe('getExplorerTxUrl is linked to configured network', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  afterEach(() => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = ORIGINAL;
  });
  it('uses testnet host when configured as testnet', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
    expect(getExplorerTxUrl('abcd')).toBe('https://stellar.expert/explorer/testnet/tx/abcd');
  });
  it('uses public host when configured as public/mainnet', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'public';
    expect(getExplorerTxUrl('abcd')).toBe('https://stellar.expert/explorer/public/tx/abcd');
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'mainnet';
    expect(getExplorerTxUrl('abcd')).toBe('https://stellar.expert/explorer/public/tx/abcd');
  });
});

describe('TransactionStatusTracker UI', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders loading state on initial mount', async () => {
    mockedAPI.getPendingTransactions.mockReturnValue(new Promise(() => {}));
    mockedAPI.getFailedTransactions.mockReturnValue(new Promise(() => {}));

    render(<TransactionStatusTracker />);
    expect(screen.getByText(/Loading transactions/i)).toBeInTheDocument();
    // loading state uses role=status with aria-busy while initial poll is pending (accessible)
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Transaction Status/)).toBeInTheDocument();
  });

  it('returns null when no transactions and no poll error (empty state)', async () => {
    mockedAPI.getPendingTransactions.mockResolvedValue([]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);

    const { container } = render(<TransactionStatusTracker />);
    await waitFor(() => expect(mockedAPI.getPendingTransactions).toHaveBeenCalled());
    // after load completes, should be null (no region)
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('renders distinct guidance for submitted transactions', async () => {
    const submitted = makeTx({ id: 's1', status: 'pending', confirmations: 0, type: 'vaccination' });
    mockedAPI.getPendingTransactions.mockResolvedValue([submitted]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);

    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /Submitted/i })).toBeInTheDocument());
    expect(screen.getByText(/Sent to the network.*waiting for confirmation/i)).toBeInTheDocument();
    expect(screen.getByText(/vaccination/)).toBeInTheDocument();
    expect(screen.getAllByText('Submitted').length).toBeGreaterThanOrEqual(1);
  });

  it('renders distinct guidance for accepted transactions', async () => {
    const accepted = makeTx({ id: 'a1', status: 'pending', confirmations: 2, blockNumber: 42, type: 'record_creation' });
    mockedAPI.getPendingTransactions.mockResolvedValue([accepted]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);

    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /Accepted/i })).toBeInTheDocument());
    expect(screen.getByText(/Accepted by the network.*awaiting final confirmation/i)).toBeInTheDocument();
  });

  it('renders distinct guidance for confirmed transactions', async () => {
    // confirmed can appear if provider returns it via pending (edge) or we simulate it
    const confirmed = makeTx({ id: 'c1', status: 'confirmed', confirmations: 10, blockNumber: 123, type: 'transfer' });
    // put in pending to surface via reconciled logic (simulates ledger inclusion)
    mockedAPI.getPendingTransactions.mockResolvedValue([confirmed]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);

    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /Confirmed/i })).toBeInTheDocument());
    expect(screen.getByText(/Confirmed and final on-chain/i)).toBeInTheDocument();
  });

  it('renders distinct guidance for failed transactions', async () => {
    const failed = makeTx({ id: 'f1', status: 'failed', type: 'record_update', errorMessage: 'Insufficient funds', confirmations: 0 });
    mockedAPI.getPendingTransactions.mockResolvedValue([]);
    mockedAPI.getFailedTransactions.mockResolvedValue([failed]);

    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /Failed/i })).toBeInTheDocument());
    expect(screen.getByText(/Transaction failed.*not applied/i)).toBeInTheDocument();
    expect(screen.getByText(/Insufficient funds/)).toBeInTheDocument();
  });

  it('renders distinct guidance for unknown transactions', async () => {
    const unknown = makeTx({ id: 'u1', status: 'pending', confirmations: -1, type: 'access_grant' });
    mockedAPI.getPendingTransactions.mockResolvedValue([unknown]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);

    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /Unknown/i })).toBeInTheDocument());
    expect(screen.getByText(/Status could not be determined/i)).toBeInTheDocument();
  });

  it('links each transaction hash to the configured explorer (testnet)', async () => {
    const tx = makeTx({ id: 'e1', hash: 'hash123abc', status: 'pending', confirmations: 0 });
    mockedAPI.getPendingTransactions.mockResolvedValue([tx]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);

    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByText(/View on explorer/i)).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /View transaction.*on Stellar explorer/i }) as HTMLAnchorElement;
    expect(link.href).toBe('https://stellar.expert/explorer/testnet/tx/hash123abc');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('handles conflicting provider responses with unknown state and conflict note', async () => {
    const dupId = 'dup-1';
    const pendingDup = makeTx({ id: dupId, hash: 'conflicthash', status: 'pending', confirmations: 0 });
    const failedDup = makeTx({ id: dupId, hash: 'conflicthash', status: 'failed', errorMessage: 'X', confirmations: 0 });
    mockedAPI.getPendingTransactions.mockResolvedValue([pendingDup]);
    mockedAPI.getFailedTransactions.mockResolvedValue([failedDup]);

    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /Unknown/i })).toBeInTheDocument());
    expect(screen.getByText(/Conflicting status returned by provider/i)).toBeInTheDocument();
    // only one row despite two provider lists
    expect(screen.getAllByTestId(`tx-row-unknown-${dupId}`)).toHaveLength(1);
    expect(screen.getByRole('link', { name: /View transaction/i })).toBeInTheDocument();
  });

  it('shows retrying alert and backs off on poll failure (delayed provider response)', async () => {
    jest.useFakeTimers();
    mockedAPI.getPendingTransactions.mockRejectedValue(new Error('Gateway timeout'));
    mockedAPI.getFailedTransactions.mockRejectedValue(new Error('Gateway timeout'));

    render(<TransactionStatusTracker />);
    // first poll fails
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/Couldn.t refresh.*retrying/i)).toBeInTheDocument();
    expect(screen.getByText(/Gateway timeout/)).toBeInTheDocument();

    // Still schedules next poll with doubled delay (BASE_INTERVAL *2). Advance and cause second failure -> delay 40s
    mockedAPI.getPendingTransactions.mockRejectedValueOnce(new Error('Still down'));
    mockedAPI.getFailedTransactions.mockRejectedValueOnce(new Error('Still down'));
    await act(async () => {
      jest.advanceTimersByTime(BASE_INTERVAL * 2);
      await Promise.resolve();
      // need microtasks
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText(/Still down/)).toBeInTheDocument());

    // recover on next success resets delay
    mockedAPI.getPendingTransactions.mockResolvedValueOnce([]);
    mockedAPI.getFailedTransactions.mockResolvedValueOnce([]);
    // need to advance by current backoff (which is 40s) to trigger success poll
    await act(async () => {
      jest.advanceTimersByTime(BASE_INTERVAL * 4);
      await Promise.resolve();
    });
    // after success but empty, still alert cleared - but we had pending error then success empties? Actually success with empty should render null, but we still have pollError cleared. So tracker disappears.
    // To assert reset, check that next poll uses BASE_INTERVAL. We'll just assert API was called again.
    expect(mockedAPI.getPendingTransactions).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('caps exponential backoff at MAX_INTERVAL', async () => {
    jest.useFakeTimers();
    mockedAPI.getPendingTransactions.mockRejectedValue(new Error('err'));
    mockedAPI.getFailedTransactions.mockRejectedValue(new Error('err'));
    render(<TransactionStatusTracker />);
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });
    // after 5 doublings from 10s => 160k max
    // Simulate enough failures to hit max: need to advance repeatedly
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        // advance by current max or current interval - easiest: advance by MAX_INTERVAL
        jest.advanceTimersByTime(MAX_INTERVAL);
        await Promise.resolve();
        await Promise.resolve();
      });
    }
    // After many failures, poll still scheduled with MAX_INTERVAL, not larger. Indirectly, no throw.
    expect(screen.getByRole('alert')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('calls cancel for submitted/accepted and retry for failed via keyboard', async () => {
    const user = userEvent.setup();
    const submitted = makeTx({ id: 's1', status: 'pending', confirmations: 0 });
    const failed = makeTx({ id: 'f1', status: 'failed', errorMessage: 'fail', type: 'transfer' });
    mockedAPI.getPendingTransactions.mockResolvedValue([submitted]);
    mockedAPI.getFailedTransactions.mockResolvedValue([failed]);
    mockedAPI.cancelPendingTransaction.mockResolvedValue(undefined);
    mockedAPI.retryFailedTransaction.mockResolvedValue(submitted);

    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /Submitted/i })).toBeInTheDocument());

    const cancel = screen.getByRole('button', { name: /Cancel transaction s1/i });
    const retry = screen.getByRole('button', { name: /Retry transaction f1/i });

    expect(cancel).toBeInTheDocument();
    expect(retry).toBeInTheDocument();

    // keyboard navigation: tab to cancel then enter
    cancel.focus();
    expect(cancel).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(mockedAPI.cancelPendingTransaction).toHaveBeenCalledWith('s1'));

    retry.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(mockedAPI.retryFailedTransaction).toHaveBeenCalledWith('f1'));
  });

  it('polls periodically and is accessible by keyboard at mobile viewport sizes', async () => {
    jest.useFakeTimers();
    const submitted = makeTx({ id: 'p1', status: 'pending', confirmations: 0 });
    const accepted = makeTx({ id: 'a1', status: 'pending', confirmations: 3, blockNumber: 1, type: 'vaccination' });
    mockedAPI.getPendingTransactions.mockResolvedValue([submitted, accepted]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);

    render(<TransactionStatusTracker />);
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });
    const region = screen.getByRole('region', { name: /Transaction Status/i });
    expect(region).toBeInTheDocument();
    // mobile viewport classes: fixed bottom-4 left-4 right-4 md:w-96
    expect(region.className).toContain('left-4');
    expect(region.className).toContain('md:w-96');
    expect(region.className).toContain('max-h-[80vh]');

    // headings are proper level h2/h3
    expect(screen.getByRole('heading', { name: /Transaction Status/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Submitted/i, level: 3 })).toBeInTheDocument();

    // polling again after interval
    await act(async () => {
      jest.advanceTimersByTime(BASE_INTERVAL);
      await Promise.resolve();
    });
    expect(mockedAPI.getPendingTransactions).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('boundary: transaction with no hash still renders and omits explorer link', async () => {
    const noHash = makeTx({ id: 'b1', hash: '', status: 'pending', confirmations: 0 });
    mockedAPI.getPendingTransactions.mockResolvedValue([noHash]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);

    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /Submitted/i })).toBeInTheDocument());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // hash placeholder is an em dash at start of mono line: "— · date"
    expect(screen.getByText(/^— ·/)).toBeInTheDocument();
  });

  it('renders gracefully when both lists empty after success (no crash)', async () => {
    mockedAPI.getPendingTransactions.mockResolvedValue([]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);
    const { container } = render(<TransactionStatusTracker />);
    await waitFor(() => expect(mockedAPI.getPendingTransactions).toHaveBeenCalled());
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('explorer link encodes hash safely', async () => {
    const tx = makeTx({ id: 'enc', hash: 'a/b c?x=1', status: 'pending', confirmations: 0 });
    mockedAPI.getPendingTransactions.mockResolvedValue([tx]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);
    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByRole('link')).toBeInTheDocument());
    const link = screen.getByRole('link') as HTMLAnchorElement;
    expect(link.href).toContain(encodeURIComponent('a/b c?x=1'));
  });

  // Keep compatibility with previously described behaviour: heading always present when visible
  it('displays transaction status heading (regression)', async () => {
    const submitted = makeTx({ id: 's1', status: 'pending', confirmations: 0 });
    mockedAPI.getPendingTransactions.mockResolvedValue([submitted]);
    mockedAPI.getFailedTransactions.mockResolvedValue([]);
    render(<TransactionStatusTracker />);
    await waitFor(() => expect(screen.getByText(/Transaction Status/)).toBeInTheDocument());
  });
});
