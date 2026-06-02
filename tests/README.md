# Integration Tests for petChain-Frontend

This directory contains comprehensive integration tests for the petChain-Frontend project, with a focus on payment scheduling functionality.

## Test Structure

```
tests/
├── integration/
│   └── scheduling.test.ts          # Comprehensive scheduling integration tests
├── helpers/
│   └── schedulingMocks.ts          # Mock factories and test utilities
└── README.md                        # This file
```

## Scheduling Integration Tests

The `scheduling.test.ts` file contains comprehensive, time-mocked integration tests covering all scheduling scenarios:

### Test Scenarios

1. **Schedule Creation** - Creating one-time and recurring schedules with various frequencies
2. **Schedule Modification** - Updating schedule properties and recurrence patterns
3. **Schedule Cancellation** - Cancelling schedules and verifying idempotency
4. **Scheduled Payment Execution** - Testing payment execution at scheduled times
5. **Recurring Payment Schedules** - Testing daily, weekly, monthly, and other recurring patterns
6. **Conflict Handling** - Verifying that multiple schedules can coexist without conflicts
7. **Timezone Handling** - Testing UTC storage and timezone-aware execution
8. **Analytics & Projections** - Testing analytics calculations and payment projections
9. **Edge Cases & Error Handling** - Testing boundary conditions and error scenarios

### Key Features

- **Time-Mocked Tests**: All tests use `jest.useFakeTimers()` with a fixed baseline date (`2024-01-15T10:00:00.000Z`) to ensure deterministic, environment-independent execution
- **Comprehensive Coverage**: 50+ test cases covering creation, modification, cancellation, execution, and edge cases
- **Reusable Mock Factories**: Helper functions in `tests/helpers/schedulingMocks.ts` for creating test data
- **Fully Typed**: All test code is fully typed with TypeScript for safety and IDE support
- **No Real Time Delays**: All tests use fake timers - zero real time delays

## Setup

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Install Jest and TypeScript support:

```bash
npm install --save-dev jest @types/jest ts-jest
```

2. The project includes `jest.config.js` and `jest.setup.js` for configuration.

### Running Tests

Run all tests:
```bash
npm test
```

Run only scheduling tests:
```bash
npm test -- tests/integration/scheduling.test.ts
```

Run tests in watch mode:
```bash
npm test -- --watch
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## Test Patterns

### Using Fake Timers

All tests automatically use fake timers in `beforeEach`:

```typescript
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(BASE_DATE);
  // ... test setup
});

afterEach(() => {
  jest.useRealTimers();
  // ... cleanup
});
```

### Advancing Time

Use the helper functions from `tests/helpers/schedulingMocks.ts`:

```typescript
import { advanceDays, advanceHours } from '../helpers/schedulingMocks';

// Advance 1 day
advanceDays(1);

// Advance 2 hours
advanceHours(2);

// Or use jest directly
jest.advanceTimersByTime(3600 * 1000); // 1 hour in milliseconds
```

### Creating Test Data

Use the mock factories:

```typescript
import { 
  createMockSchedule, 
  createMockRecurringSchedule,
  DEFAULT_NOTIFICATION_SETTINGS 
} from '../helpers/schedulingMocks';

// Create a one-time schedule
const schedule = createMockSchedule({
  meterId: 'meter-001',
  amount: 100,
});

// Create a weekly recurring schedule
const weeklySchedule = createMockRecurringSchedule(ScheduleFrequency.WEEKLY, {
  meterId: 'meter-002',
  amount: 50,
});
```

## Reliability Rules

These rules ensure tests are deterministic and reliable:

1. **Never use `new Date()` in assertions** - Always derive from `BASE_DATE` using explicit offsets
2. **Never use `setTimeout` with real delays** - Always use fake timers
3. **Never assert on absolute timestamps** - Assert on relative offsets from `BASE_DATE`
4. **Always reset fake timers in `afterEach`** - Never let timer state leak between tests
5. **Mock all external API calls** - No real HTTP in integration tests
6. **Clean up persistent state** - Clear localStorage and service state in `afterEach`

## Troubleshooting

### Tests fail with "localStorage is not defined"

The `jest.setup.js` file should handle this. If not, ensure it's referenced in `jest.config.js`:

```javascript
setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
```

### Tests fail with "jest is not defined"

Ensure Jest is installed and the test file is run with Jest:

```bash
npm test -- tests/integration/scheduling.test.ts
```

### Timer-related test failures

Check that:
1. `jest.useFakeTimers()` is called in `beforeEach`
2. `jest.useRealTimers()` is called in `afterEach`
3. All time-dependent assertions use offsets from `BASE_DATE`

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Use the mock factories from `tests/helpers/schedulingMocks.ts`
3. Use fake timers for all time-dependent tests
4. Add descriptive test names that explain what is being tested
5. Include comments for complex test logic
6. Ensure tests are independent and don't rely on execution order

## References

- [Jest Documentation](https://jestjs.io/)
- [Jest Timer Mocks](https://jestjs.io/docs/timer-mocks)
- [TypeScript Testing](https://www.typescriptlang.org/docs/handbook/testing.html)
