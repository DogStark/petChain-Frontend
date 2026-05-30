/**
 * Debug Tests
 * Verifies development-only debug utilities, logging, feature flags,
 * performance monitoring, and production safety guarantees.
 *
 * Run with:
 *   npx ts-node --project tsconfig.test.json tests/debug.test.ts
 */

import assert from 'node:assert/strict';
import {
  attachDebugToWindow,
  captureDebugState,
  clearLogHistory,
  clearPerformanceMetrics,
  debugError,
  debugInfo,
  debugLog,
  debugWarn,
  endPerformanceMeasure,
  getDebugConfig,
  getDebugInfo,
  getDevTools,
  getFeatureFlags,
  getLogHistory,
  getPerformanceMetrics,
  getPerformanceStats,
  initializeDebugMode,
  isDebugEnabled,
  isFeatureFlagEnabled,
  registerFeatureFlag,
  resetDebugState,
  resetFeatureFlags,
  setFeatureFlag,
  setLogLevel,
  startPerformanceMeasure,
  useDebugLogger,
} from '../src/utils/debug';

type TestFn = () => void | Promise<void>;

const silentConsole = {
  debug: () => undefined,
  error: () => undefined,
  info: () => undefined,
  log: () => undefined,
  warn: () => undefined,
};

let passed = 0;
let failed = 0;

function test(name: string, fn: TestFn): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  \u2713 ${name}`);
      passed += 1;
    })
    .catch((error: unknown) => {
      console.error(`  \u2717 ${name}`);
      console.error(`    ${(error as Error).message}`);
      failed += 1;
    });
}

function setUp(): void {
  resetDebugState();
  const scope = globalThis as Record<string, unknown>;
  scope.window = {
    console: silentConsole,
    __DEBUG_DISABLED__: false,
  };
}

function tearDownWindow(): void {
  delete (globalThis as Record<string, unknown>).window;
}

async function withNodeEnv<T>(value: string | undefined, fn: () => Promise<T> | T): Promise<T> {
  const previous = process.env.NODE_ENV;
  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }

  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
}

async function main(): Promise<void> {
  console.log('\n=== Debug Mode Activation ===');

  await test('debug mode is disabled by default', () => {
    setUp();
    assert.equal(isDebugEnabled(), false);
  });

  await test('can initialize debug mode in development', () => {
    setUp();
    assert.equal(initializeDebugMode({ logLevel: 'info' }), true);
    assert.equal(isDebugEnabled(), true);
  });

  await test('initializes with the requested configuration', () => {
    setUp();
    initializeDebugMode({
      logLevel: 'debug',
      enablePerformanceMonitoring: true,
      enableFeatureFlags: true,
      enableDeveloperTools: true,
    });

    const config = getDebugConfig();
    assert.equal(config.logLevel, 'debug');
    assert.equal(config.enablePerformanceMonitoring, true);
    assert.equal(config.enableFeatureFlags, true);
    assert.equal(config.enableDeveloperTools, true);
  });

  await test('can update the log level after initialization', () => {
    setUp();
    initializeDebugMode({ logLevel: 'info' });
    setLogLevel('warn');

    assert.equal(getDebugConfig().logLevel, 'warn');
  });

  console.log('\n=== Logging Functionality ===');

  await test('debug logging stores entries in history', () => {
    setUp();
    initializeDebugMode({ logLevel: 'debug' });

    debugLog('Test log message', { key: 'value' });
    const history = getLogHistory();

    assert.equal(history.length, 1);
    assert.equal(history[0].message, 'Test log message');
    assert.equal(history[0].level, 'debug');
    assert.deepEqual(history[0].args[0], { key: 'value' });
  });

  await test('different log levels are tracked correctly', () => {
    setUp();
    initializeDebugMode({ logLevel: 'debug' });

    debugError('Error message');
    debugWarn('Warn message');
    debugInfo('Info message');
    debugLog('Debug message');

    const history = getLogHistory();
    assert.equal(history.length, 4);
    assert.deepEqual(
      history.map((entry) => entry.level),
      ['error', 'warn', 'info', 'debug']
    );
  });

  await test('can filter and limit log history', () => {
    setUp();
    initializeDebugMode({ logLevel: 'debug' });

    debugError('Error 1');
    debugWarn('Warn 1');
    debugError('Error 2');
    debugLog('Debug 1');

    const errors = getLogHistory({ level: 'error' });
    const latestTwo = getLogHistory({ limit: 2 });

    assert.equal(errors.length, 2);
    assert.ok(errors.every((entry) => entry.level === 'error'));
    assert.equal(latestTwo.length, 2);
    assert.equal(latestTwo[1].message, 'Debug 1');
  });

  await test('can clear log history', () => {
    setUp();
    initializeDebugMode({ logLevel: 'debug' });

    debugLog('Message 1');
    debugLog('Message 2');
    assert.equal(getLogHistory().length, 2);

    clearLogHistory();
    assert.equal(getLogHistory().length, 0);
  });

  console.log('\n=== Debug Information Display ===');

  await test('debug info reflects the active environment', async () => {
    await withNodeEnv(undefined, () => {
      setUp();
      initializeDebugMode({ logLevel: 'warn' });

      const info = getDebugInfo();
      assert.equal(info.environment, 'development');
      assert.equal(info.debugEnabled, true);
      assert.equal(info.logLevel, 'warn');
    });
  });

  await test('debug info counts logs, flags, and metrics', () => {
    setUp();
    initializeDebugMode({
      logLevel: 'debug',
      enableFeatureFlags: true,
      enablePerformanceMonitoring: true,
    });

    debugLog('Log 1');
    registerFeatureFlag('feature-a', true);
    const endMeasure = startPerformanceMeasure('render');
    endMeasure();

    const info = getDebugInfo();
    assert.equal(info.logCount, 3);
    assert.equal(info.metricsCount, 1);
    assert.deepEqual(info.featureFlagsEnabled, ['feature-a']);
  });

  await test('captureDebugState returns a safe snapshot', () => {
    setUp();
    initializeDebugMode({
      logLevel: 'debug',
      enableFeatureFlags: true,
      enablePerformanceMonitoring: true,
    });

    debugLog('Snapshot log');
    registerFeatureFlag('snapshot-flag', true);
    const endMeasure = startPerformanceMeasure('snapshot');
    endMeasure();

    const state = captureDebugState();
    assert.equal(typeof state.config, 'object');
    assert.equal(typeof state.info, 'object');
    assert.equal(Array.isArray(state.logs), true);
    assert.equal(Array.isArray(state.metrics), true);
    assert.equal(typeof state.featureFlags, 'object');
  });

  console.log('\n=== Feature Flags ===');

  await test('can register, update, and reset feature flags', () => {
    setUp();
    initializeDebugMode({ enableFeatureFlags: true });

    registerFeatureFlag('flag-a', true);
    registerFeatureFlag('flag-b', false);
    setFeatureFlag('flag-b', true);

    assert.equal(isFeatureFlagEnabled('flag-a'), true);
    assert.equal(isFeatureFlagEnabled('flag-b'), true);
    assert.deepEqual(getFeatureFlags(), { 'flag-a': true, 'flag-b': true });

    resetFeatureFlags();
    assert.deepEqual(getFeatureFlags(), {});
  });

  await test('returns false for unknown flags', () => {
    setUp();
    initializeDebugMode({ enableFeatureFlags: true });

    assert.equal(isFeatureFlagEnabled('missing-flag'), false);
  });

  console.log('\n=== Performance Monitoring ===');

  await test('can measure performance and store metrics', async () => {
    setUp();
    initializeDebugMode({ enablePerformanceMonitoring: true, logLevel: 'debug' });

    const endMeasure = startPerformanceMeasure('operation');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const metric = endMeasure();

    assert.notEqual(metric, null);
    assert.equal(metric?.name, 'operation');
    assert.ok((metric?.duration ?? 0) >= 0);
    assert.equal(getPerformanceMetrics().length, 1);
  });

  await test('can filter metrics and compute statistics', async () => {
    setUp();
    initializeDebugMode({ enablePerformanceMonitoring: true });

    const first = startPerformanceMeasure('render');
    await new Promise((resolve) => setTimeout(resolve, 2));
    first();

    const second = startPerformanceMeasure('fetch');
    await new Promise((resolve) => setTimeout(resolve, 2));
    second();

    const renderMetrics = getPerformanceMetrics({ name: 'render' });
    const stats = getPerformanceStats('render');

    assert.equal(renderMetrics.length, 1);
    assert.equal(renderMetrics[0].name, 'render');
    assert.equal(stats?.count, 1);
    assert.ok((stats?.avgDuration ?? 0) >= 0);
  });

  await test('returns a noop when monitoring is disabled', () => {
    setUp();
    initializeDebugMode({ enablePerformanceMonitoring: false });

    const endMeasure = startPerformanceMeasure('disabled');
    assert.equal(typeof endMeasure, 'function');
    assert.equal(endMeasure(), null);
    assert.equal(getPerformanceMetrics().length, 0);
  });

  console.log('\n=== Development Tools Integration ===');

  await test('getDevTools exposes the expected helpers', () => {
    setUp();
    initializeDebugMode({ enablePerformanceMonitoring: true });

    const tools = getDevTools();
    assert.equal(typeof tools.getDebugInfo, 'function');
    assert.equal(typeof tools.captureState, 'function');
    assert.equal(typeof tools.triggerBreakpoint, 'function');
    assert.equal(typeof tools.getMetrics, 'function');
    assert.equal(Array.isArray(tools.getMetrics()), true);
  });

  await test('attachDebugToWindow publishes a debug namespace in development', () => {
    setUp();
    initializeDebugMode({ logLevel: 'debug', enableFeatureFlags: true, enablePerformanceMonitoring: true });

    attachDebugToWindow();
    const windowObject = (globalThis as Record<string, unknown>).window as
      | {
          __debug__?: Record<string, unknown>;
        }
      | undefined;

    assert.equal(typeof windowObject?.__debug__, 'object');
    assert.equal(typeof windowObject?.__debug__?.log, 'function');
    assert.equal(typeof windowObject?.__debug__?.getMetrics, 'function');
  });

  await test('useDebugLogger prefixes messages with the component name', () => {
    setUp();
    initializeDebugMode({ logLevel: 'debug' });

    const logger = useDebugLogger('MyComponent');
    logger.log('Test message');

    const history = getLogHistory();
    assert.equal(history.some((entry) => entry.message.includes('[MyComponent]')), true);
  });

  console.log('\n=== Production Safety ===');

  await test('debug initialization is blocked in production', async () => {
    await withNodeEnv('production', () => {
      setUp();

      assert.equal(initializeDebugMode({ logLevel: 'debug' }), false);
      assert.equal(isDebugEnabled(), false);
      assert.equal(getDebugInfo().environment, 'production');
      assert.equal(getLogHistory().length, 0);
    });
  });

  await test('logging does not leak into production history', async () => {
    await withNodeEnv('production', () => {
      setUp();

      debugLog('Should not persist');
      debugInfo('Should not persist');
      debugWarn('Should not persist');
      debugError('Should not persist');

      assert.equal(getLogHistory().length, 0);
      assert.equal(captureDebugState().logs instanceof Array, true);
      assert.equal((captureDebugState().logs as unknown[]).length, 0);
    });
  });

  await test('feature flags and metrics are hidden in production', async () => {
    await withNodeEnv('production', () => {
      setUp();

      registerFeatureFlag('prod-flag', true);
      const endMeasure = startPerformanceMeasure('prod-operation');
      const metric = endMeasure();

      assert.equal(isFeatureFlagEnabled('prod-flag'), false);
      assert.deepEqual(getFeatureFlags(), {});
      assert.equal(metric, null);
      assert.equal(getPerformanceMetrics().length, 0);
      assert.equal(getPerformanceStats('prod-operation'), null);
    });
  });

  await test('attachDebugToWindow is a no-op in production', async () => {
    await withNodeEnv('production', () => {
      setUp();
      attachDebugToWindow();

      const windowObject = (globalThis as Record<string, unknown>).window as
        | {
            __debug__?: Record<string, unknown>;
          }
        | undefined;
      assert.equal(windowObject?.__debug__, undefined);
    });
  });

  tearDownWindow();

  console.log('\n========================================');
  console.log(`Tests completed: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
