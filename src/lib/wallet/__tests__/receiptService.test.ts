import { receiptService } from '../receiptService';
import type { WalletIntent } from '../walletReceipts';
import type { BroadcastResult } from '@/types/wallet';
import type { Transaction } from '@/lib/api/transactionAPI';

describe('ReceiptService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  const sampleIntent: WalletIntent = {
    action: 'send_payment',
    sourcePublicKey: 'GBZXN3Z3XWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXWXW',
    destination: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQWF5GHGKSXL6TBRDY4KPJVTHZSJ',
    amountAsset: '50 XLM',
    memo: 'Veterinary care payment',
    feeLevel: 'recommended',
    estimatedFee: '100',
    network: 'TESTNET',
    createdAt: Date.now(),
    idempotencyKey: 'idempotency-key-123',
  };

  describe('Successful Transaction Flow', () => {
    it('creates and saves a successful transaction receipt with all audit fields', () => {
      const broadcastResult: BroadcastResult = {
        hash: 'txhash-success-123',
        ledger: 12345,
        successful: true,
        envelopeXdr: 'AAAA...',
        resultXdr: 'AAAA...',
      };

      const receipt = receiptService.createAndSave({
        intent: sampleIntent,
        broadcastResult,
        network: 'TESTNET',
      });

      expect(receipt).toBeDefined();
      expect(receipt.id).toBe('idempotency-key-123');
      // Distinguishes intent
      expect(receipt.intent.action).toBe('send_payment');
      expect(receipt.intent.destination).toBe(sampleIntent.destination);
      // Distinguishes submitted operation
      expect(receipt.submitted.hash).toBe('txhash-success-123');
      expect(receipt.submitted.successful).toBe(true);
      // Distinguishes final status
      expect(receipt.status.finality).toBe('accepted'); // or confirmed based on ledger
      expect(receipt.status.guidance).toBeDefined();
      // Distinguishes explorer link
      expect(receipt.explorer.url).toContain('txhash-success-123');
      expect(receipt.explorer.label).toContain('Testnet Explorer');

      // Survives refresh (retrieved from localStorage)
      const fetched = receiptService.getReceipt('idempotency-key-123');
      expect(fetched).toEqual(receipt);
    });
  });

  describe('Rejected / Failed Transaction Flow', () => {
    it('handles rejected or failed transactions with appropriate status and guidance', () => {
      const error = new Error('Transaction rejected by user signature');

      const receipt = receiptService.createAndSave({
        intent: sampleIntent,
        error,
        network: 'TESTNET',
      });

      expect(receipt.submitted.successful).toBe(false);
      expect(receipt.submitted.error).toBe('Transaction rejected by user signature');
      expect(receipt.status.finality).toBe('failed');
      expect(receipt.status.tone).toBe('error');
      expect(receipt.status.guidance).toContain('failed');

      const attentionList = receiptService.getAttentionRequired();
      expect(attentionList).toContainEqual(receipt);
    });
  });

  describe('Replaced Transaction Flow', () => {
    it('updates receipt status when a transaction is replaced or re-submitted', () => {
      const broadcastResult: BroadcastResult = {
        hash: 'txhash-original-123',
        ledger: 0,
        successful: true,
        envelopeXdr: '',
        resultXdr: '',
      };

      const receipt = receiptService.createAndSave({
        intent: sampleIntent,
        broadcastResult,
        network: 'TESTNET',
      });

      expect(receipt.status.finality).toBe('submitted');

      // Simulate update from network where transaction is replaced / confirmed with new hash
      const updatedTx: Transaction = {
        id: 'tx-1',
        hash: 'txhash-replaced-456',
        type: 'transfer',
        status: 'confirmed',
        fromAddress: sampleIntent.sourcePublicKey,
        toAddress: sampleIntent.destination,
        amount: '50',
        fee: '200',
        timestamp: new Date().toISOString(),
        blockNumber: 99999,
        confirmations: 5,
      };

      const updated = receiptService.updateReceipt(receipt.id, updatedTx);

      expect(updated).toBeDefined();
      expect(updated?.submitted.hash).toBe('txhash-replaced-456');
      expect(updated?.status.finality).toBe('confirmed');
      expect(updated?.status.confirmations).toBe(5);
      expect(updated?.explorer.url).toContain('txhash-replaced-456');
    });
  });

  describe('Partial Multi-Operation Flows', () => {
    it('supports tracking multi-operation transaction batches with individual parts', () => {
      const parentId = 'multi-parent-123';
      const op1Intent: WalletIntent = { ...sampleIntent, idempotencyKey: `${parentId}-op-0` };
      const op2Intent: WalletIntent = { ...sampleIntent, idempotencyKey: `${parentId}-op-1` };

      const receipt1 = receiptService.createAndSave({
        intent: op1Intent,
        broadcastResult: { hash: 'hash-op-1', ledger: 100, successful: true, envelopeXdr: '', resultXdr: '' },
        network: 'TESTNET',
        isMultiOperation: true,
        operationIndex: 0,
        operationCount: 2,
        parentReceiptId: parentId,
      });

      const receipt2 = receiptService.createAndSave({
        intent: op2Intent,
        error: new Error('Second operation failed due to low limit'),
        network: 'TESTNET',
        isMultiOperation: true,
        operationIndex: 1,
        operationCount: 2,
        parentReceiptId: parentId,
      });

      const groups = receiptService.getMultiOperationGroups();
      expect(groups.has(parentId)).toBe(true);
      const group = groups.get(parentId)!;
      expect(group).toHaveLength(2);
      expect(group[0].operationIndex).toBe(0);
      expect(group[1].operationIndex).toBe(1);
      expect(group[1].status.finality).toBe('failed');
    });
  });

  describe('Security: Sensitive Signing Material', () => {
    it('never persists or exposes sensitive material (PIN, secret keys, passwords)', () => {
      // Attempt to save receipt object containing secret fields
      const maliciousReceipt: any = {
        id: 'malicious-test',
        intent: {
          ...sampleIntent,
          pin: '123456',
          secretKey: 'SABC...',
          privateKey: 'SECRET',
          seed: 'word1 word2...',
          password: 'my-password',
        },
        submitted: {
          hash: 'hash-1',
          ledger: 1,
          successful: true,
        },
        status: {
          finality: 'confirmed',
          label: 'Confirmed',
          guidance: 'OK',
          tone: 'success',
          confirmations: 1,
          updatedAt: Date.now(),
          isConflict: false,
        },
        explorer: { url: 'https://...', label: 'Explorer' },
        isMultiOperation: false,
      };

      const saved = receiptService.saveReceipt(maliciousReceipt);

      // Verify no sensitive keys exist in returned or stored object
      expect(saved.intent).not.toHaveProperty('pin');
      expect(saved.intent).not.toHaveProperty('secretKey');
      expect(saved.intent).not.toHaveProperty('privateKey');
      expect(saved.intent).not.toHaveProperty('seed');
      expect(saved.intent).not.toHaveProperty('password');

      const rawStorage = localStorage.getItem('petchain_wallet_receipts');
      expect(rawStorage).not.toContain('123456');
      expect(rawStorage).not.toContain('SABC...');
      expect(rawStorage).not.toContain('word1');
      expect(rawStorage).not.toContain('my-password');
    });
  });
});
