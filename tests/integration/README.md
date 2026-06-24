# Payment Integration Tests

Comprehensive integration tests for the petChain payment system, covering payment flows, error handling, refunds, and blockchain interactions.

## Overview

These tests verify critical payment functionality including:
- Payment initiation and validation
- Transaction confirmation and broadcasting
- Payment failure scenarios
- Refund functionality
- Payment history retrieval and filtering
- Blockchain mock interactions
- Error handling and edge cases
- Multi-asset payments
- Fee management
- Transaction state management
- Concurrent payment handling
- Audit and compliance tracking

## Test Coverage

### Payment Initiation (4 tests)
- Valid payment transaction creation
- Payment amount validation
- Stellar destination address validation
- Payment asset type validation

### Payment Confirmation (3 tests)
- Valid broadcast result creation
- Successful payment confirmation
- XDR metadata inclusion in confirmation

### Payment Failure Scenarios (5 tests)
- Insufficient balance detection
- Invalid destination address rejection
- Invalid payment amount rejection
- Payment failure details capture
- Transaction timeout handling

### Refund Functionality (4 tests)
- Refund transaction creation
- Refund amount matching original
- Asset type preservation
- Refund audit trail maintenance

### Payment History (4 tests)
- Payment history structure
- History filtering by status
- History sorting by timestamp
- History pagination support

### Blockchain Mock Interactions (4 tests)
- Mock Stellar account creation
- Mock transaction response creation
- Multiple mock account handling
- Mock account balance updates

### Error Handling & Edge Cases (8 tests)
- Wallet not found handling
- Invalid PIN detection
- Network error handling
- Transaction rejection handling
- Duplicate payment detection
- Memo length validation
- Large payment amounts
- Small payment amounts (stroops)

### Multi-Asset Payments (3 tests)
- Native XLM payment processing
- Credit asset payment processing
- Asset code and issuer separation

### Fee Management (3 tests)
- Transaction fee estimation
- Custom fee application
- Minimum fee validation

### Transaction State (2 tests)
- Transaction state progression
- Valid state transitions

### Concurrent Payments (2 tests)
- Concurrent payment request handling
- Sequential payment queueing

### Audit & Compliance (3 tests)
- Audit log creation
- Compliance checks
- Timestamp accuracy

### Integration Scenarios (3 tests)
- Full payment flow completion
- Payment with memo and custom fee
- Failed payment retry logic

**Total: 51 tests covering all payment scenarios**

## Running the Tests

### Prerequisites
```bash
npm install
```

### Run All Tests
```bash
npm test
# or directly:
npx ts-node --project tsconfig.test.json tests/integration/payment.test.ts
```

### Expected Output
```
── Payment Initiation Tests ──
  ✓ should create valid payment transaction
  ✓ should validate positive payment amount
  ✓ should validate Stellar destination address
  ✓ should validate payment asset types

── Payment Confirmation Tests ──
  ✓ should create valid broadcast result
  ✓ should confirm successful payment
  ✓ should include XDR data in confirmation

... (remaining tests)

──────────────────────────────────────
Tests passed: 51
Tests failed: 0
Total tests: 51
──────────────────────────────────────
```

## Test Architecture

### Mock Setup
- **MockLocalStorage**: Node environment localStorage implementation
- **CreateMockAccount**: Generates mock Stellar account objects
- **CreateMockTransaction**: Generates mock transaction responses

### Test Fixtures
- `MOCK_WALLET`: Standard test wallet with all required fields
- `MOCK_RECIPIENT`: Valid Stellar public key for destination
- `MOCK_PAYMENT_TX`: Complete payment transaction example

### Test Utilities
- `test()`: Wrapper function for async test execution with error handling
- Results tracking: `testsPassed` and `testsFailed` counters
- Detailed error reporting with stack traces

## Key Features

### 1. Payment Validation
Tests ensure payments are properly validated before broadcasting:
- Amount is positive and within limits
- Destination is a valid Stellar public key
- Asset format is correct (XLM or CODE:ISSUER)
- Memo length is within Stellar limits

### 2. Transaction Broadcasting
Tests verify transaction creation and broadcasting:
- Transactions contain proper XDR envelope data
- Results include transaction hash and ledger number
- Success/failure status is captured
- Metadata is preserved

### 3. Error Scenarios
Comprehensive error handling tests cover:
- Network connectivity failures
- Insufficient account balance
- Invalid wallet or PIN
- Transaction timeouts
- Duplicate payment detection

### 4. Refund Processing
Tests ensure refunds maintain data integrity:
- Refund amounts match original transactions
- Asset types are preserved
- Audit trails capture refund details
- Reverse transactions are properly constructed

### 5. History and Audit
Tests verify transaction history functionality:
- History records all required fields
- Filtering by status works correctly
- Sorting by timestamp is accurate
- Pagination handles large datasets
- Audit logs capture all details

### 6. Multi-Asset Support
Tests verify support for multiple asset types:
- Native XLM payments
- Credit asset payments with issuer
- Asset code parsing
- Multi-currency transactions

### 7. Fee Management
Tests ensure fee handling is correct:
- Fee estimation returns valid tiers
- Custom fees are applied to transactions
- Minimum fees are enforced
- Fee progression: base < recommended < high

## Mocking Strategy

The tests use comprehensive mocking of Stellar blockchain interactions:

```typescript
// Mock account with realistic Stellar response
const mockAccount = createMockAccount(publicKey);
// Returns: { accountId(), sequence, balances, signers, thresholds }

// Mock transaction response
const mockTx = createMockTransaction(hash);
// Returns: { hash, ledger, successful, envelope_xdr, result_xdr }
```

This allows testing payment logic without actual blockchain calls.

## Integration with CI/CD

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Payment Integration Tests
  run: npm test
```

- No external dependencies (uses mocks)
- Deterministic results
- Fast execution (<5 seconds)
- Clear pass/fail status

## Future Enhancements

Potential test expansions:
- Multi-signature transaction tests
- Payment streaming tests
- Large transaction batches
- Fee spike scenarios
- Network partition handling
- Blockchain fork recovery

## Related Files

- `src/lib/wallet/walletService.ts`: Payment service implementation
- `src/types/wallet.ts`: Payment type definitions
- `src/lib/blockchain/StellarService.ts`: Stellar integration
- `src/lib/api/transactionAPI.ts`: Transaction API
