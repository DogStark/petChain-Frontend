import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionSigning from '../TransactionSigning';
import type { WalletAccount, WalletBalance } from '../../../types/wallet';

describe('TransactionSigning', () => {
  const mockWallet: WalletAccount = {
    id: 'wallet1',
    publicKey: 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    encryptedSecretKey: 'encrypted',
    iv: 'iv',
    salt: 'salt',
    label: 'Test Wallet',
    type: 'standard',
    network: 'TESTNET',
    createdAt: new Date().toISOString(),
    backupVerified: true,
  };

  const mockBalances: WalletBalance[] = [
    { asset_type: 'native', balance: '100.0000000' }
  ];

  const defaultProps = {
    wallet: mockWallet,
    balances: mockBalances,
    feeEstimate: { base: '100', recommended: '100', high: '100' },
    onSendPayment: jest.fn(),
    onRefreshFee: jest.fn(),
    loading: false,
    error: null,
    onClearError: jest.fn(),
    isTestnet: true,
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('clears the PIN after 5 minutes of inactivity', () => {
    render(<TransactionSigning {...defaultProps} />);
    
    const pinInput = screen.getByPlaceholderText('Enter PIN to sign…');
    fireEvent.change(pinInput, { target: { value: '123456' } });
    
    expect(pinInput).toHaveValue('123456');

    // Fast-forward 4 minutes and 59 seconds
    act(() => {
      jest.advanceTimersByTime(299000);
    });
    
    expect(pinInput).toHaveValue('123456');

    // Fast-forward 1 more second
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    expect(pinInput).toHaveValue('');
    expect(screen.getByText('Session expired due to inactivity. Please re-enter your PIN.')).toBeInTheDocument();
  });

  it('clears the PIN when the app goes into the background', () => {
    render(<TransactionSigning {...defaultProps} />);
    
    const pinInput = screen.getByPlaceholderText('Enter PIN to sign…');
    fireEvent.change(pinInput, { target: { value: '123456' } });
    
    expect(pinInput).toHaveValue('123456');

    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    expect(pinInput).toHaveValue('');
    expect(screen.getByText('Session locked for security. Please re-enter your PIN.')).toBeInTheDocument();
  });
});
