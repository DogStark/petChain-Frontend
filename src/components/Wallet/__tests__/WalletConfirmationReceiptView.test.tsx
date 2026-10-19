import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WalletConfirmationReceiptView from '../WalletConfirmationReceiptView';
import type { WalletReceipt } from '@/lib/wallet/walletReceipts';

describe('WalletConfirmationReceiptView', () => {
  const sampleReceipt: WalletReceipt = {
    id: 'receipt-123',
    intent: {
      action: 'send_payment',
      sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
      destination: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQWF5GHGKSXL6TBRDY4KPJVTHZSJ',
      amountAsset: '50 XLM',
      memo: 'Test payment memo',
      network: 'TESTNET',
      createdAt: Date.now(),
      idempotencyKey: 'receipt-123',
    },
    submitted: {
      hash: 'abcdef1234567890abcdef1234567890abcdef12',
      ledger: 1234,
      successful: true,
      submittedAt: Date.now(),
    },
    status: {
      finality: 'confirmed',
      label: 'Confirmed',
      guidance: 'Confirmed and final on-chain.',
      tone: 'success',
      confirmations: 10,
      blockNumber: 1234,
      updatedAt: Date.now(),
      isConflict: false,
    },
    explorer: {
      url: 'https://stellar.expert/explorer/testnet/tx/abcdef',
      label: 'View on Stellar Testnet Explorer',
    },
    isMultiOperation: false,
  };

  it('renders receipt distinguishing intent, submitted operation, final status, and explorer link', () => {
    render(<WalletConfirmationReceiptView receipt={sampleReceipt} />);

    // Intent
    expect(screen.getByText('Send Payment Receipt')).toBeInTheDocument();
    expect(screen.getByText('Test payment memo')).toBeInTheDocument();
    expect(screen.getByText('50 XLM')).toBeInTheDocument();

    // Submitted operation
    expect(screen.getByText('Successful')).toBeInTheDocument();

    // Final status & guidance
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Confirmed and final on-chain.')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument(); // confirmations

    // Explorer link
    const explorerLink = screen.getByRole('link', { name: /View on Stellar Testnet Explorer/i });
    expect(explorerLink).toBeInTheDocument();
    expect(explorerLink).toHaveAttribute('href', sampleReceipt.explorer.url);
  });

  it('handles failed / rejected transactions with appropriate status and error guidance', () => {
    const failedReceipt: WalletReceipt = {
      ...sampleReceipt,
      submitted: {
        ...sampleReceipt.submitted,
        successful: false,
        error: 'tx_failed: op_underfunded',
      },
      status: {
        finality: 'failed',
        label: 'Failed',
        guidance: 'Transaction failed — it was not applied.',
        tone: 'error',
        confirmations: 0,
        updatedAt: Date.now(),
        isConflict: false,
      },
    };

    render(<WalletConfirmationReceiptView receipt={failedReceipt} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Transaction failed — it was not applied.')).toBeInTheDocument();
    expect(screen.getByText(/tx_failed: op_underfunded/)).toBeInTheDocument();
  });

  it('handles partial multi-operation flows correctly', () => {
    const multiOpReceipt: WalletReceipt = {
      ...sampleReceipt,
      isMultiOperation: true,
      operationIndex: 0,
      operationCount: 3,
    };

    render(<WalletConfirmationReceiptView receipt={multiOpReceipt} />);

    expect(screen.getByText(/Audit Receipt \(1\/3\)/)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const mockClose = jest.fn();
    render(<WalletConfirmationReceiptView receipt={sampleReceipt} onClose={mockClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close receipt/i });
    fireEvent.click(closeBtn);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
