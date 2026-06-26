import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TransactionStatusTracker from './TransactionStatusTracker';
import * as useTransactionsModule from '@/hooks/useTransactions';

const mockPendingTransactions = [
  {
    id: 'tx-1',
    hash: '0x1234567890abcdef',
    type: 'record_creation' as const,
    status: 'pending' as const,
    fromAddress: '0xfrom',
    fee: '0.1',
    timestamp: '2024-01-01T00:00:00Z',
    confirmations: 0,
  },
];

const mockFailedTransactions = [
  {
    id: 'tx-2',
    hash: '0xfedcba0987654321',
    type: 'record_update' as const,
    status: 'failed' as const,
    fromAddress: '0xfrom',
    fee: '0.1',
    timestamp: '2024-01-02T00:00:00Z',
    confirmations: 0,
    errorMessage: 'Insufficient funds',
  },
];

describe('TransactionStatusTracker', () => {
  beforeEach(() => {
    jest.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
      transactions: [],
      pending: mockPendingTransactions,
      failed: mockFailedTransactions,
      loading: false,
      error: null,
      fetchTransactions: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getTransactionCost: jest.fn(),
      retryTransaction: jest.fn(),
      cancelTransaction: jest.fn(),
      estimateCost: jest.fn(),
      fetchPendingTransactions: jest.fn().mockResolvedValue(mockPendingTransactions),
      fetchFailedTransactions: jest.fn().mockResolvedValue(mockFailedTransactions),
      getTotalCosts: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders pending transactions when data is available', async () => {
    const { getByText } = render(<TransactionStatusTracker />);

    await waitFor(() => {
      expect(getByText(/Pending \(1\)/)).toBeInTheDocument();
      expect(getByText(/record_creation/)).toBeInTheDocument();
    });
  });

  it('renders failed transactions when data is available', async () => {
    const { getByText } = render(<TransactionStatusTracker />);

    await waitFor(() => {
      expect(getByText(/Failed \(1\)/)).toBeInTheDocument();
      expect(getByText(/record_update/)).toBeInTheDocument();
      expect(getByText(/Insufficient funds/)).toBeInTheDocument();
    });
  });

  it('returns null when no pending or failed transactions', () => {
    jest.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
      transactions: [],
      pending: [],
      failed: [],
      loading: false,
      error: null,
      fetchTransactions: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getTransactionCost: jest.fn(),
      retryTransaction: jest.fn(),
      cancelTransaction: jest.fn(),
      estimateCost: jest.fn(),
      fetchPendingTransactions: jest.fn(),
      fetchFailedTransactions: jest.fn(),
      getTotalCosts: jest.fn(),
    });

    const { container } = render(<TransactionStatusTracker />);
    expect(container.firstChild).toBeNull();
  });

  it('calls cancelTransaction when cancel button is clicked', async () => {
    const mockCancel = jest.fn();
    jest.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
      transactions: [],
      pending: mockPendingTransactions,
      failed: mockFailedTransactions,
      loading: false,
      error: null,
      fetchTransactions: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getTransactionCost: jest.fn(),
      retryTransaction: jest.fn(),
      cancelTransaction: mockCancel,
      estimateCost: jest.fn(),
      fetchPendingTransactions: jest.fn(),
      fetchFailedTransactions: jest.fn(),
      getTotalCosts: jest.fn(),
    });

    const { getByText } = render(<TransactionStatusTracker />);

    await waitFor(() => {
      const cancelButtons = getByText(/Cancel/);
      fireEvent.click(cancelButtons);
      expect(mockCancel).toHaveBeenCalledWith('tx-1');
    });
  });

  it('calls retryTransaction when retry button is clicked', async () => {
    const mockRetry = jest.fn();
    jest.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
      transactions: [],
      pending: mockPendingTransactions,
      failed: mockFailedTransactions,
      loading: false,
      error: null,
      fetchTransactions: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getTransactionCost: jest.fn(),
      retryTransaction: mockRetry,
      cancelTransaction: jest.fn(),
      estimateCost: jest.fn(),
      fetchPendingTransactions: jest.fn(),
      fetchFailedTransactions: jest.fn(),
      getTotalCosts: jest.fn(),
    });

    const { getByText } = render(<TransactionStatusTracker />);

    await waitFor(() => {
      const retryButtons = getByText(/Retry/);
      fireEvent.click(retryButtons);
      expect(mockRetry).toHaveBeenCalledWith('tx-2');
    });
  });

  it('displays transaction status heading', async () => {
    const { getByText } = render(<TransactionStatusTracker />);

    await waitFor(() => {
      expect(getByText(/Transaction Status/)).toBeInTheDocument();
    });
  });

  it('polls for transaction status every 10 seconds', async () => {
    const mockFetchPending = jest.fn().mockResolvedValue(mockPendingTransactions);
    const mockFetchFailed = jest.fn().mockResolvedValue(mockFailedTransactions);

    jest.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
      transactions: [],
      pending: mockPendingTransactions,
      failed: mockFailedTransactions,
      loading: false,
      error: null,
      fetchTransactions: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getTransactionCost: jest.fn(),
      retryTransaction: jest.fn(),
      cancelTransaction: jest.fn(),
      estimateCost: jest.fn(),
      fetchPendingTransactions: mockFetchPending,
      fetchFailedTransactions: mockFetchFailed,
      getTotalCosts: jest.fn(),
    });

    jest.useFakeTimers();
    render(<TransactionStatusTracker />);

    expect(mockFetchPending).toHaveBeenCalled();
    expect(mockFetchFailed).toHaveBeenCalled();

    jest.advanceTimersByTime(10000);

    expect(mockFetchPending).toHaveBeenCalledTimes(2);
    expect(mockFetchFailed).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});
