import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TransactionCostTracker from './TransactionCostTracker';
import * as useTransactionsModule from '@/hooks/useTransactions';

const mockCostData = {
  totalFees: '5.5',
  totalTransactions: 50,
  averageFee: '0.11',
  estimatedUSD: 687.5,
};

describe('TransactionCostTracker', () => {
  beforeEach(() => {
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
      getTotalCosts: jest.fn().mockResolvedValue(mockCostData),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders cost data correctly', async () => {
    const { getByText } = render(<TransactionCostTracker />);

    await waitFor(() => {
      expect(getByText(/5.5/)).toBeInTheDocument();
      expect(getByText(/50/)).toBeInTheDocument();
      expect(getByText(/0.11/)).toBeInTheDocument();
    });
  });

  it('displays estimated USD value when available', async () => {
    const { getByText } = render(<TransactionCostTracker />);

    await waitFor(() => {
      expect(getByText(/687.50/)).toBeInTheDocument();
    });
  });

  it('updates data when period changes to 7d', async () => {
    const mockGetTotalCosts = jest.fn().mockResolvedValue(mockCostData);
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
      getTotalCosts: mockGetTotalCosts,
    });

    const { getByValue } = render(<TransactionCostTracker />);

    await waitFor(() => {
      const select = getByValue('30d') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: '7d' } });
    });

    await waitFor(() => {
      expect(mockGetTotalCosts).toHaveBeenCalled();
    });
  });

  it('updates data when period changes to all', async () => {
    const mockGetTotalCosts = jest.fn().mockResolvedValue(mockCostData);
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
      getTotalCosts: mockGetTotalCosts,
    });

    const { getByValue } = render(<TransactionCostTracker />);

    await waitFor(() => {
      const select = getByValue('30d') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'all' } });
    });

    await waitFor(() => {
      expect(mockGetTotalCosts).toHaveBeenCalled();
    });
  });

  it('renders transaction costs heading', () => {
    const { getByText } = render(<TransactionCostTracker />);
    expect(getByText(/Transaction Costs/)).toBeInTheDocument();
  });

  it('displays all cost metrics', async () => {
    const { getByText } = render(<TransactionCostTracker />);

    await waitFor(() => {
      expect(getByText(/Total Fees/)).toBeInTheDocument();
      expect(getByText(/Total Transactions/)).toBeInTheDocument();
      expect(getByText(/Average Fee/)).toBeInTheDocument();
    });
  });
});
