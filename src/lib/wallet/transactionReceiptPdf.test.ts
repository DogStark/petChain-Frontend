import type { Transaction } from '@/lib/api/transactionAPI';
import {
  createTransactionReceiptPdf,
  isReceiptEligibleTransaction,
} from './transactionReceiptPdf';

const confirmedTransaction: Transaction = {
  id: 'server-transaction-id',
  hash: 'a'.repeat(64),
  type: 'transfer',
  status: 'confirmed',
  fromAddress: 'private-source-address',
  toAddress: 'private-recipient-address',
  amount: '50',
  fee: '100',
  timestamp: '2026-10-22T10:00:00.000Z',
  blockNumber: 12345,
  confirmations: 10,
  metadata: { memo: 'private veterinary information' },
};

describe('transaction receipt PDF', () => {
  it('creates a PDF using confirmed ledger fields without account metadata', () => {
    const pdf = new TextDecoder().decode(
      createTransactionReceiptPdf(confirmedTransaction, 'TESTNET')
    );

    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('Status: Confirmed');
    expect(pdf).toContain('Network: Stellar Testnet');
    expect(pdf).toContain(`Transaction hash: ${confirmedTransaction.hash}`);
    expect(pdf).toContain('Ledger: 12345');
    expect(pdf).toContain('Confirmations: 10');
    expect(pdf).not.toContain('private-source-address');
    expect(pdf).not.toContain('private-recipient-address');
    expect(pdf).not.toContain('private veterinary information');
  });

  it.each([
    ['non-wallet transaction', { type: 'record_creation' as const }],
    ['pending', { status: 'pending' as const }],
    ['missing hash', { hash: '' }],
    ['missing ledger', { blockNumber: undefined }],
    ['invalid ledger', { blockNumber: 0 }],
  ])('rejects transactions that are not receipt-eligible: %s', (_case, overrides) => {
    const transaction = { ...confirmedTransaction, ...overrides };
    expect(isReceiptEligibleTransaction(transaction)).toBe(false);
    expect(() => createTransactionReceiptPdf(transaction, 'PUBLIC')).toThrow(
      /confirmed transactions/
    );
  });
});
