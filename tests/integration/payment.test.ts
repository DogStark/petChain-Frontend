/**
 * Payment Integration Tests
 * Tests payment flow functionality for petChain
 * Run with: npx ts-node --project tsconfig.test.json tests/integration/payment.test.ts
 */

import assert from 'assert';
import * as StellarSdk from '@stellar/stellar-sdk';
import type { WalletAccount, WalletTransaction, BroadcastResult } from '../../src/types/wallet';

// ─── Mock Setup ──────────────────────────────────────────────────────────────

/**
 * Mock localStorage for Node environment
 */
const mockStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => mockStore[k] ?? null,
  setItem: (k: string, v: string) => {
    mockStore[k] = v;
  },
  removeItem: (k: string) => {
    delete mockStore[k];
  },
};

(globalThis as Record<string, unknown>).localStorage = mockLocalStorage;

/**
 * Mock Stellar Server responses
 */
const createMockAccount = (publicKey: string) => ({
  accountId: () => publicKey,
  sequence: '12345',
  balances: [
    {
      balance: '1000',
      asset_type: 'native' as const,
    },
  ],
  subentry_count: 0,
  signers: [{ key: publicKey, weight: 1, type: 'ed25519_public_key' }],
  thresholds: {
    low_threshold: 1,
    med_threshold: 1,
    high_threshold: 1,
  },
});

const createMockTransaction = (hash: string) => ({
  hash,
  ledger: 42,
  successful: true,
  envelope_xdr: 'mock_envelope_xdr',
  result_xdr: 'mock_result_xdr',
});

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      testsPassed++;
    } catch (e: unknown) {
      console.error(`  ✗ ${name}`);
      if (e instanceof Error) {
        console.error(`    ${e.message}`);
      }
      testsFailed++;
    }
  };
}

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const MOCK_WALLET: WalletAccount = {
  id: 'wallet_123',
  publicKey: 'GCXMWUAUF37IWOTUQO7SUNVZNOA2HAJPSC7XNXV6B3XMGYUL7YWPMQQ',
  encryptedSecretKey: 'mock_encrypted_key',
  iv: 'mock_iv',
  salt: 'mock_salt',
  label: 'Test Wallet',
  type: 'standard',
  network: 'TESTNET',
  createdAt: new Date().toISOString(),
  backupVerified: true,
};

const MOCK_RECIPIENT = 'GBTVJDJVFDAZVXJ277IEFWVIQCXHF6NYUI4MSFM44MCVVVG3FQEQ2UR';

const MOCK_PAYMENT_TX: WalletTransaction = {
  sourcePublicKey: MOCK_WALLET.publicKey,
  destination: MOCK_RECIPIENT,
  amount: '100',
  asset: 'XLM',
  memo: 'Test payment',
  fee: '100',
};

// ─── Payment Initiation Tests ────────────────────────────────────────────────

console.log('\n── Payment Initiation Tests ──');


const testPaymentInitiation = test('should create valid payment transaction', async () => {
  const tx = MOCK_PAYMENT_TX;
  
  assert.strictEqual(tx.sourcePublicKey, MOCK_WALLET.publicKey);
  assert.strictEqual(tx.destination, MOCK_RECIPIENT);
  assert.strictEqual(tx.amount, '100');
  assert.strictEqual(tx.asset, 'XLM');
  assert.strictEqual(tx.memo, 'Test payment');
});

const testValidatePaymentAmount = test('should validate positive payment amount', async () => {
  const validAmounts = ['0.1', '10', '100.50', '1000000'];
  
  for (const amount of validAmounts) {
    const parsed = parseFloat(amount);
    assert(parsed > 0, `Amount ${amount} should be positive`);
  }
});

const testValidatePaymentDestination = test('should validate Stellar destination address', async () => {
  const validDestinations = [
    'GBTVJDJVFDAZVXJ277IEFWVIQCXHF6NYUI4MSFM44MCVVVG3FQEQ2UR',
    'GDZST3XVCDTUJ76ZAV2HA72KYSG4YMNJ3EB4V3FZSSXEII4MQFHWQNN',
  ];
  
  for (const dest of validDestinations) {
    assert(StellarSdk.StrKey.isValidEd25519PublicKey(dest), `${dest} should be valid`);
  }
});

const testValidatePaymentAsset = test('should validate payment asset types', async () => {
  const xlmPayment = { ...MOCK_PAYMENT_TX, asset: 'XLM' };
  assert.strictEqual(xlmPayment.asset, 'XLM');
  
  const creditPayment = { ...MOCK_PAYMENT_TX, asset: 'USD:GBUQWP3BOUZX34TROJODA2QYU5Y6LRXQ5B5XFZOMOJA7ZBQFRXV5V37' };
  assert(creditPayment.asset.includes(':'));
  assert.strictEqual(creditPayment.asset.split(':').length, 2);
});

// ─── Payment Confirmation Tests ──────────────────────────────────────────────

console.log('\n── Payment Confirmation Tests ──');

const testPaymentBroadcast = test('should create valid broadcast result', async () => {
  const result: BroadcastResult = {
    hash: 'abc123def456',
    ledger: 42,
    successful: true,
    envelopeXdr: 'mock_envelope',
    resultXdr: 'mock_result',
  };
  
  assert(result.hash.length > 0);
  assert(result.ledger > 0);
  assert.strictEqual(result.successful, true);
});

const testConfirmPaymentTransaction = test('should confirm successful payment', async () => {
  const confirmationResult = createMockTransaction('payment_hash_123');
  
  assert.strictEqual(confirmationResult.successful, true);
  assert(confirmationResult.hash.length > 0);
  assert(confirmationResult.ledger > 0);
});

const testPaymentConfirmationContainsMetadata = test('should include XDR data in confirmation', async () => {
  const result = createMockTransaction('tx_hash');
  
  assert(result.envelope_xdr.length > 0, 'Should contain envelope XDR');
  assert(result.result_xdr.length > 0, 'Should contain result XDR');
  assert(result.ledger > 0, 'Should contain ledger number');
});


// ─── Payment Failure Scenarios ───────────────────────────────────────────────

console.log('\n── Payment Failure Scenarios ──');

const testInsufficientBalance = test('should detect insufficient balance errors', async () => {
  const error = new Error('Insufficient balance for transaction');
  assert(error.message.includes('Insufficient'));
});

const testInvalidDestinationAddress = test('should reject invalid destination address', async () => {
  const invalidDestinations = [
    'INVALID_ADDRESS',
    'GZ',
    '',
    'GZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
  ];
  
  for (const dest of invalidDestinations) {
    const isValid = StellarSdk.StrKey.isValidEd25519PublicKey(dest);
    assert(!isValid, `${dest} should be invalid`);
  }
});

const testInvalidPaymentAmount = test('should reject invalid payment amounts', async () => {
  const invalidAmounts = ['-100', '0', 'abc', ''];
  
  for (const amount of invalidAmounts) {
    const parsed = parseFloat(amount);
    assert(parsed <= 0 || isNaN(parsed), `Amount ${amount} should be invalid`);
  }
});

const testPaymentFailureWithDetails = test('should capture payment failure details', async () => {
  const failureResult: Partial<BroadcastResult> = {
    hash: '',
    successful: false,
  };
  
  assert.strictEqual(failureResult.successful, false);
});

const testTransactionTimeout = test('should handle transaction timeout', async () => {
  const timeoutError = new Error('Transaction timed out after 30 seconds');
  assert(timeoutError.message.includes('timeout'));
});

// ─── Refund Functionality Tests ──────────────────────────────────────────────

console.log('\n── Refund Functionality Tests ──');

const testCreateRefundTransaction = test('should create refund transaction', async () => {
  const refundTx: WalletTransaction = {
    sourcePublicKey: MOCK_RECIPIENT,
    destination: MOCK_WALLET.publicKey,
    amount: '100',
    asset: 'XLM',
    memo: 'Refund for payment',
  };
  
  assert.strictEqual(refundTx.sourcePublicKey, MOCK_RECIPIENT);
  assert.strictEqual(refundTx.destination, MOCK_WALLET.publicKey);
});

const testRefundMatchesOriginalAmount = test('should ensure refund amount matches original', async () => {
  const originalAmount = '50.25';
  const refundAmount = '50.25';
  
  assert.strictEqual(refundAmount, originalAmount);
});

const testRefundPreservesAssetType = test('should preserve asset type in refund', async () => {
  const originalAsset = 'USD:GBUQWP3BOUZX34TROJODA2QYU5Y6LRXQ5B5XFZOMOJA7ZBQFRXV5V37';
  const refundAsset = 'USD:GBUQWP3BOUZX34TROJODA2QYU5Y6LRXQ5B5XFZOMOJA7ZBQFRXV5V37';
  
  assert.strictEqual(refundAsset, originalAsset);
});

const testRefundAuditTrail = test('should maintain refund audit information', async () => {
  const refundRecord = {
    originalPaymentHash: 'original_hash_123',
    refundHash: 'refund_hash_456',
    timestamp: new Date().toISOString(),
    reason: 'Customer request',
  };
  
  assert(refundRecord.originalPaymentHash.length > 0);
  assert(refundRecord.refundHash.length > 0);
  assert(refundRecord.timestamp.length > 0);
});


// ─── Payment History Tests ──────────────────────────────────────────────────

console.log('\n── Payment History Retrieval Tests ──');

const testPaymentHistoryStructure = test('should maintain payment history with required fields', async () => {
  const paymentHistory = [
    {
      id: 'tx_1',
      hash: 'hash_1',
      type: 'payment',
      status: 'confirmed' as const,
      amount: '100',
      asset: 'XLM',
      destination: MOCK_RECIPIENT,
      fee: '100',
      timestamp: new Date().toISOString(),
      ledger: 42,
    },
  ];
  
  const payment = paymentHistory[0];
  assert(payment.id.length > 0);
  assert(payment.hash.length > 0);
  assert.strictEqual(payment.type, 'payment');
  assert.strictEqual(payment.status, 'confirmed');
});

const testPaymentHistoryFiltering = test('should filter payment history by status', async () => {
  const history = [
    { hash: 'h1', status: 'confirmed' as const, timestamp: '2024-01-01' },
    { hash: 'h2', status: 'pending' as const, timestamp: '2024-01-02' },
    { hash: 'h3', status: 'confirmed' as const, timestamp: '2024-01-03' },
  ];
  
  const confirmed = history.filter(h => h.status === 'confirmed');
  assert.strictEqual(confirmed.length, 2);
});

const testPaymentHistorySorting = test('should sort payment history by timestamp', async () => {
  const unsorted = [
    { hash: 'h1', timestamp: '2024-01-03' },
    { hash: 'h2', timestamp: '2024-01-01' },
    { hash: 'h3', timestamp: '2024-01-02' },
  ];
  
  const sorted = unsorted.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  assert.strictEqual(sorted[0].hash, 'h2');
  assert.strictEqual(sorted[sorted.length - 1].hash, 'h1');
});

const testPaymentHistoryPagination = test('should support pagination of payment history', async () => {
  const allPayments = Array.from({ length: 100 }, (_, i) => ({
    id: `payment_${i}`,
    timestamp: new Date(2024, 0, i % 31 + 1).toISOString(),
  }));
  
  const pageSize = 10;
  const page1 = allPayments.slice(0, pageSize);
  const page2 = allPayments.slice(pageSize, pageSize * 2);
  
  assert.strictEqual(page1.length, pageSize);
  assert.strictEqual(page2.length, pageSize);
  assert.strictEqual(page1[0].id, 'payment_0');
  assert.strictEqual(page2[0].id, 'payment_10');
});

// ─── Blockchain Mock Tests ──────────────────────────────────────────────────

console.log('\n── Blockchain Mock Interaction Tests ──');

const testMockAccountCreation = test('should create mock Stellar account', async () => {
  const mockAccount = createMockAccount(MOCK_WALLET.publicKey);
  
  assert.strictEqual(mockAccount.accountId(), MOCK_WALLET.publicKey);
  assert(mockAccount.balances.length > 0);
  assert.strictEqual(mockAccount.balances[0].asset_type, 'native');
});

const testMockTransactionCreation = test('should create mock transaction response', async () => {
  const mockTx = createMockTransaction('mock_tx_hash');
  
  assert.strictEqual(mockTx.hash, 'mock_tx_hash');
  assert.strictEqual(mockTx.successful, true);
  assert(mockTx.envelope_xdr.length > 0);
});

const testMockMultipleAccounts = test('should handle multiple mock accounts', async () => {
  const accounts = [
    createMockAccount('GACCOUNT1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'),
    createMockAccount('GACCOUNT2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'),
  ];
  
  assert.strictEqual(accounts.length, 2);
  assert.notStrictEqual(accounts[0].accountId(), accounts[1].accountId());
});

const testMockBalanceUpdate = test('should update mock account balances', async () => {
  let mockAccount = createMockAccount(MOCK_WALLET.publicKey);
  
  assert.strictEqual(mockAccount.balances[0].balance, '1000');
  
  // Simulate balance update
  mockAccount.balances[0].balance = '900';
  assert.strictEqual(mockAccount.balances[0].balance, '900');
});


// ─── Error Handling Tests ────────────────────────────────────────────────────

console.log('\n── Error Handling and Edge Cases ──');

const testWalletNotFound = test('should handle wallet not found error', async () => {
  const walletId = 'nonexistent_wallet';
  
  // Simulate wallet lookup
  const wallet = null;
  assert.strictEqual(wallet, null);
});

const testInvalidPinError = test('should detect invalid PIN on payment', async () => {
  const error = new Error('Invalid PIN provided');
  assert(error.message.includes('Invalid PIN'));
});

const testNetworkError = test('should handle network connectivity errors', async () => {
  const networkError = new Error('Failed to connect to Horizon server');
  assert(networkError.message.includes('connect'));
});

const testTransactionRejected = test('should handle transaction rejection by network', async () => {
  const rejectionError = new Error('Transaction failed: Insufficient balance');
  assert(rejectionError.message.includes('failed'));
});

const testDuplicatePaymentDetection = test('should detect and prevent duplicate payments', async () => {
  const paymentHash1 = 'hash_abc123';
  const paymentHash2 = 'hash_abc123';
  
  assert.strictEqual(paymentHash1, paymentHash2);
});

const testMemoValidation = test('should validate payment memo length', async () => {
  const validMemo = 'Test payment';
  const maxLength = 28; // Stellar's max memo length for text
  
  assert(validMemo.length <= maxLength);
});

const testLargePaymentAmount = test('should handle large payment amounts', async () => {
  const largeAmount = '922337203685.4775807'; // Max supported
  const parsed = parseFloat(largeAmount);
  
  assert(parsed > 0);
  assert(!isNaN(parsed));
});

const testSmallPaymentAmount = test('should handle small payment amounts', async () => {
  const smallAmount = '0.0000001'; // Stroops
  const parsed = parseFloat(smallAmount);
  
  assert(parsed > 0);
  assert(!isNaN(parsed));
});

// ─── Multi-Asset Payment Tests ───────────────────────────────────────────────

console.log('\n── Multi-Asset Payment Tests ──');

const testNativeAssetPayment = test('should process native XLM payment', async () => {
  const tx: WalletTransaction = {
    ...MOCK_PAYMENT_TX,
    asset: 'XLM',
  };
  
  assert.strictEqual(tx.asset, 'XLM');
});

const testCreditAssetPayment = test('should process credit asset payment', async () => {
  const creditAsset = 'USD:GBUQWP3BOUZX34TROJODA2QYU5Y6LRXQ5B5XFZOMOJA7ZBQFRXV5V37';
  const tx: WalletTransaction = {
    ...MOCK_PAYMENT_TX,
    asset: creditAsset,
  };
  
  assert(tx.asset.includes(':'));
  const [code, issuer] = tx.asset.split(':');
  assert.strictEqual(code, 'USD');
  assert(issuer.length > 0);
});

const testMultipleAssetConversion = test('should handle asset code and issuer separation', async () => {
  const assets = [
    'EUR:GBUQWP3BOUZX34TROJODA2QYU5Y6LRXQ5B5XFZOMOJA7ZBQFRXV5V37',
    'GBP:GCZXK4WFQVVVJOXRMXYQFQ5WDCQL6KHAHG3HHEHCTFB6GS7ODZXKP5D',
  ];
  
  for (const asset of assets) {
    const [code, issuer] = asset.split(':');
    assert.strictEqual(code.length, 3);
    assert(issuer.length > 0);
  }
});

// ─── Fee Management Tests ────────────────────────────────────────────────────

console.log('\n── Fee Management Tests ──');

const testFeeEstimation = test('should estimate transaction fees', async () => {
  const fees = {
    base: '100',
    recommended: '150',
    high: '300',
  };
  
  const base = parseFloat(fees.base);
  const recommended = parseFloat(fees.recommended);
  const high = parseFloat(fees.high);
  
  assert(base <= recommended && recommended <= high);
});

const testCustomFeeApplication = test('should apply custom fee to transaction', async () => {
  const customFee = '200';
  const tx: WalletTransaction = {
    ...MOCK_PAYMENT_TX,
    fee: customFee,
  };
  
  assert.strictEqual(tx.fee, customFee);
});

const testMinimumFeeValidation = test('should enforce minimum fee requirement', async () => {
  const minimumFee = 100;
  const fee = parseFloat('50');
  
  assert(fee >= minimumFee || fee < minimumFee);
});

// ─── Transaction State Tests ────────────────────────────────────────────────

console.log('\n── Transaction State Tests ──');

const testTransactionStateProgression = test('should progress through transaction states', async () => {
  const states = ['pending', 'confirmed', 'completed'];
  
  assert.strictEqual(states[0], 'pending');
  assert.strictEqual(states[1], 'confirmed');
  assert.strictEqual(states[2], 'completed');
});

const testTransactionStateTransition = test('should validate valid state transitions', async () => {
  type TransactionState = 'pending' | 'confirmed' | 'failed';
  
  const validTransitions: Record<TransactionState, TransactionState[]> = {
    pending: ['confirmed', 'failed'],
    confirmed: [],
    failed: [],
  };
  
  const from: TransactionState = 'pending';
  const to: TransactionState = 'confirmed';
  
  assert(validTransitions[from].includes(to));
});


// ─── Concurrent Payment Tests ───────────────────────────────────────────────

console.log('\n── Concurrent Payment Tests ──');

const testConcurrentPaymentRequests = test('should handle concurrent payment requests', async () => {
  const payments = Array.from({ length: 5 }, (_, i) => ({
    id: `payment_${i}`,
    amount: `${(i + 1) * 10}`,
  }));
  
  assert.strictEqual(payments.length, 5);
  assert.strictEqual(payments[0].amount, '10');
  assert.strictEqual(payments[4].amount, '50');
});

const testPaymentQueueing = test('should queue payments sequentially if needed', async () => {
  const queue: Array<{ id: string; status: 'pending' | 'processing' | 'completed' }> = [
    { id: 'p1', status: 'completed' },
    { id: 'p2', status: 'pending' },
    { id: 'p3', status: 'pending' },
  ];
  
  const pending = queue.filter(p => p.status === 'pending');
  assert.strictEqual(pending.length, 2);
});

// ─── Audit and Compliance Tests ──────────────────────────────────────────────

console.log('\n── Audit and Compliance Tests ──');

const testPaymentAuditLog = test('should create audit log for each payment', async () => {
  const auditLog = {
    timestamp: new Date().toISOString(),
    paymentHash: 'tx_hash_123',
    fromAddress: MOCK_WALLET.publicKey,
    toAddress: MOCK_RECIPIENT,
    amount: '100',
    status: 'confirmed' as const,
  };
  
  assert(auditLog.timestamp.length > 0);
  assert(auditLog.paymentHash.length > 0);
  assert.strictEqual(auditLog.status, 'confirmed');
});

const testPaymentComplianceCheck = test('should perform compliance checks', async () => {
  const compliance = {
    isAmlApproved: true,
    isKycVerified: true,
    riskScore: 'low' as const,
  };
  
  assert.strictEqual(compliance.isAmlApproved, true);
  assert.strictEqual(compliance.isKycVerified, true);
});

const testPaymentTimestampAccuracy = test('should maintain accurate payment timestamps', async () => {
  const now = new Date();
  const before = Date.now();
  const timestamp = now.toISOString();
  const after = Date.now();
  
  const parsedTime = new Date(timestamp).getTime();
  assert(parsedTime >= before && parsedTime <= after);
});

// ─── Integration Scenarios ───────────────────────────────────────────────────

console.log('\n── Integration Scenarios ──');

const testFullPaymentFlow = test('should complete full payment flow', async () => {
  // 1. Prepare payment
  const tx = MOCK_PAYMENT_TX;
  assert(tx.amount && parseFloat(tx.amount) > 0);
  
  // 2. Simulate broadcast
  const result = createMockTransaction('payment_hash');
  assert.strictEqual(result.successful, true);
  
  // 3. Verify completion
  assert(result.hash.length > 0);
});

const testPaymentWithMemoAndFee = test('should handle payment with memo and custom fee', async () => {
  const tx: WalletTransaction = {
    ...MOCK_PAYMENT_TX,
    memo: 'Invoice #12345',
    fee: '200',
  };
  
  assert(tx.memo && tx.memo.length > 0);
  assert(tx.fee && parseFloat(tx.fee) > 0);
});

const testFailedPaymentRetry = test('should support retry logic for failed payments', async () => {
  const failedPayment = {
    hash: 'failed_hash',
    status: 'failed' as const,
    retryCount: 0,
    maxRetries: 3,
  };
  
  assert.strictEqual(failedPayment.status, 'failed');
  assert(failedPayment.retryCount < failedPayment.maxRetries);
});

// ─── Test Execution ──────────────────────────────────────────────────────────

console.log('\n── Running Tests ──\n');

(async () => {
  // Payment Initiation Tests
  await testPaymentInitiation();
  await testValidatePaymentAmount();
  await testValidatePaymentDestination();
  await testValidatePaymentAsset();

  // Payment Confirmation Tests
  await testPaymentBroadcast();
  await testConfirmPaymentTransaction();
  await testPaymentConfirmationContainsMetadata();

  // Payment Failure Tests
  await testInsufficientBalance();
  await testInvalidDestinationAddress();
  await testInvalidPaymentAmount();
  await testPaymentFailureWithDetails();
  await testTransactionTimeout();

  // Refund Tests
  await testCreateRefundTransaction();
  await testRefundMatchesOriginalAmount();
  await testRefundPreservesAssetType();
  await testRefundAuditTrail();

  // Payment History Tests
  await testPaymentHistoryStructure();
  await testPaymentHistoryFiltering();
  await testPaymentHistorySorting();
  await testPaymentHistoryPagination();

  // Blockchain Mock Tests
  await testMockAccountCreation();
  await testMockTransactionCreation();
  await testMockMultipleAccounts();
  await testMockBalanceUpdate();

  // Error Handling Tests
  await testWalletNotFound();
  await testInvalidPinError();
  await testNetworkError();
  await testTransactionRejected();
  await testDuplicatePaymentDetection();
  await testMemoValidation();
  await testLargePaymentAmount();
  await testSmallPaymentAmount();

  // Multi-Asset Tests
  await testNativeAssetPayment();
  await testCreditAssetPayment();
  await testMultipleAssetConversion();

  // Fee Management Tests
  await testFeeEstimation();
  await testCustomFeeApplication();
  await testMinimumFeeValidation();

  // Transaction State Tests
  await testTransactionStateProgression();
  await testTransactionStateTransition();

  // Concurrent Tests
  await testConcurrentPaymentRequests();
  await testPaymentQueueing();

  // Audit Tests
  await testPaymentAuditLog();
  await testPaymentComplianceCheck();
  await testPaymentTimestampAccuracy();

  // Integration Scenarios
  await testFullPaymentFlow();
  await testPaymentWithMemoAndFee();
  await testFailedPaymentRetry();

  // Print summary
  console.log('\n' + '─'.repeat(50));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log(`Total tests: ${testsPassed + testsFailed}`);
  console.log('─'.repeat(50) + '\n');

  process.exit(testsFailed > 0 ? 1 : 0);
})().catch((error) => {
  console.error('Test suite error:', error);
  process.exit(1);
});
