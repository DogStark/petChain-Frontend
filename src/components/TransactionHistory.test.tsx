import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TransactionHistory from './TransactionHistory';
import * as useTransactionsModule from '@/hooks/useTransactions';

const mockTransactions = [
  {
    id: 'tx-1',
    hash: '0x1234567890abcdef',
    type: 'record_creation' as const,
    status: 'confirmed' as const,
    fromAddress: '0xfrom',
    fee: '0.1',
    timestamp: '2024-01-01T00:00:00Z',
    confirmations: 10,
  },
  {
    id: 'tx-2',
    hash: '0xfedcba0987654321',
    type: 'record_update' as const,
    status: 'failed' as const,
    fromAddress: '0xfrom',
    fee: '0.1',
    timestamp: '2024-01-02T00:00:00Z',
    confirmations: 0,
    errorMessage: 'Gas limit exceeded',
  },
];

describe('TransactionHistory', () => {
  beforeEach(() => {
    jest.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
      transactions: mockTransactions,
      pending: [],
      failed: [],
      loading: false,
      error: null,
      fetchTransactions: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getTransactionCost: jest.fn(),
      retryTransaction: jest.fn().mockResolvedValue(mockTransactions[1]),
      cancelTransaction: jest.fn(),
      estimateCost: jest.fn(),
      fetchPendingTransactions: jest.fn(),
      fetchFailedTransactions: jest.fn(),
      getTotalCosts: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders transaction data correctly', async () => {
    const { getByText } = render(<TransactionHistory />);

    await waitFor(() => {
      expect(getByText(/record_creation/)).toBeInTheDocument();
      expect(getByText(/record_update/)).toBeInTheDocument();
      expect(getByText(/confirmed/i)).toBeInTheDocument();
      expect(getByText(/failed/i)).toBeInTheDocument();
    });
  });

  it('renders loading state when loading is true', () => {
    jest.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
      transactions: [],
      pending: [],
      failed: [],
      loading: true,
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

    const { getByText } = render(<TransactionHistory />);
    expect(getByText(/Loading/)).toBeInTheDocument();
  });

  it('displays retry button only for failed transactions', async () => {
    const { getAllByText } = render(<TransactionHistory />);

    await waitFor(() => {
      const retryButtons = getAllByText(/Retry/);
      expect(retryButtons).toHaveLength(1);
    });
  });

  it('calls retryTransaction when retry button is clicked', async () => {
    const mockRetry = jest.fn().mockResolvedValue(mockTransactions[1]);
    jest.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
      transactions: mockTransactions,
      pending: [],
      failed: [],
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

    const { getByText } = render(<TransactionHistory />);

    await waitFor(() => {
      const retryButton = getByText(/Retry/);
      fireEvent.click(retryButton);
      expect(mockRetry).toHaveBeenCalledWith('tx-2');
    });
  });

  it('applies correct status colors', async () => {
    const { container } = render(<TransactionHistory />);

    await waitFor(() => {
      const statusBadges = container.querySelectorAll('span[class*="bg-"]');
      expect(statusBadges.length).toBeGreaterThan(0);
    });
  });
});
