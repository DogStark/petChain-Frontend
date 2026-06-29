import { render, screen, waitFor } from '@testing-library/react';
import TransactionDetails from './TransactionDetails';
import * as useTransactionsModule from '@/hooks/useTransactions';

const mockTransaction = {
  id: 'tx-1',
  hash: '0x1234567890abcdef',
  type: 'record_creation' as const,
  status: 'confirmed' as const,
  fromAddress: '0xfrom',
  toAddress: '0xto',
  fee: '0.1',
  timestamp: '2024-01-01T00:00:00Z',
  confirmations: 10,
};

const mockReceipt = {
  transactionId: 'tx-1',
  hash: '0x1234567890abcdef',
  status: 'confirmed' as const,
  blockNumber: 12345,
  timestamp: '2024-01-01T00:00:00Z',
  gasUsed: '21000',
  effectiveFee: '0.1',
  logs: [],
};

const mockCost = {
  baseFee: '0.05',
  priorityFee: '0.05',
  totalFee: '0.1',
  estimatedUSD: 12.5,
};

describe('TransactionDetails', () => {
  beforeEach(() => {
    jest.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
      transactions: [],
      pending: [],
      failed: [],
      loading: false,
      error: null,
      fetchTransactions: jest.fn(),
      getTransaction: jest.fn().mockResolvedValue(mockTransaction),
      getTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
      getTransactionCost: jest.fn().mockResolvedValue(mockCost),
      retryTransaction: jest.fn(),
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

  it('renders transaction data when useTransactions returns data', async () => {
    const { getByText } = render(
      <TransactionDetails transactionId="tx-1" onClose={jest.fn()} />
    );

    await waitFor(() => {
      expect(getByText(/0x1234567890abcdef/)).toBeInTheDocument();
      expect(getByText(/confirmed/i)).toBeInTheDocument();
    });
  });

  it('renders loading state initially', () => {
    const { getByText } = render(
      <TransactionDetails transactionId="tx-1" onClose={jest.fn()} />
    );

    expect(getByText(/Loading/)).toBeInTheDocument();
  });

  it('renders cost breakdown when data is available', async () => {
    const { getByText } = render(
      <TransactionDetails transactionId="tx-1" onClose={jest.fn()} />
    );

    await waitFor(() => {
      expect(getByText(/Cost Breakdown/)).toBeInTheDocument();
      expect(getByText(/Base Fee:/)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const mockOnClose = jest.fn();
    const { getByText } = render(
      <TransactionDetails transactionId="tx-1" onClose={mockOnClose} />
    );

    await waitFor(() => {
      const closeButton = getByText('✕');
      closeButton.click();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles missing receipt and cost gracefully', async () => {
    jest.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
      transactions: [],
      pending: [],
      failed: [],
      loading: false,
      error: null,
      fetchTransactions: jest.fn(),
      getTransaction: jest.fn().mockResolvedValue(mockTransaction),
      getTransactionReceipt: jest.fn().mockRejectedValue(new Error('Not found')),
      getTransactionCost: jest.fn().mockRejectedValue(new Error('Not found')),
      retryTransaction: jest.fn(),
      cancelTransaction: jest.fn(),
      estimateCost: jest.fn(),
      fetchPendingTransactions: jest.fn(),
      fetchFailedTransactions: jest.fn(),
      getTotalCosts: jest.fn(),
    });

    const { queryByText } = render(
      <TransactionDetails transactionId="tx-1" onClose={jest.fn()} />
    );

    await waitFor(() => {
      expect(queryByText(/Cost Breakdown/)).not.toBeInTheDocument();
      expect(queryByText(/Receipt/)).not.toBeInTheDocument();
    });
  });
});
