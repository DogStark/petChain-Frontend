/**
 * Debug Utilities
 * Development-only logging, feature flags, and performance monitoring helpers.
 * Production builds should stay free of debug state and debug-only output.
 */

export interface DebugConfig {
  enabled: boolean;
  logLevel: 'silent' | 'error' | 'warn' | 'info' | 'debug';
  enablePerformanceMonitoring: boolean;
  enableFeatureFlags: boolean;
  enableDeveloperTools: boolean;
}

export interface FeatureFlagSet {
  [key: string]: boolean;
}

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface DebugInfo {
  timestamp: number;
  environment: string;
  debugEnabled: boolean;
  logLevel: string;
  featureFlagsEnabled: string[];
  logCount: number;
  metricsCount: number;
}

export interface DevTools {
  getDebugInfo: () => DebugInfo;
  captureState: () => Record<string, unknown>;
  triggerBreakpoint: () => void;
  getMetrics: () => PerformanceMetric[];
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  args: unknown[];
}

const defaultDebugConfig: DebugConfig = {
  enabled: false,
  logLevel: 'silent',
  enablePerformanceMonitoring: false,
  enableFeatureFlags: false,
  enableDeveloperTools: false,
};

let debugConfig: DebugConfig = { ...defaultDebugConfig };
let featureFlags: FeatureFlagSet = {};
const logHistory: LogEntry[] = [];
const performanceMetrics: PerformanceMetric[] = [];
const performanceTimers: Map<string, number> = new Map();
const MAX_LOG_HISTORY = 1000;
const MAX_METRICS_HISTORY = 500;

function isProduction(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return true;
  }

  if (typeof window !== 'undefined' && (window as Window & { __DEBUG_DISABLED__?: boolean }).__DEBUG_DISABLED__ === true) {
    return true;
  }

  return false;
}

function getConsoleMethod(level: LogLevel): ((...args: unknown[]) => void) | undefined {
  if (typeof window !== 'undefined' && (window as Window & { console?: Console }).console?.[level]) {
    return (window as Window & { console: Console }).console[level].bind(window.console);
  }

  if (typeof console !== 'undefined' && console[level]) {
    return console[level].bind(console);
  }

  return undefined;
}

function shouldLog(level: LogLevel): boolean {
  if (isProduction() || !isDebugEnabled()) {
    return false;
  }

  if (debugConfig.logLevel === 'silent') {
    return false;
  }

  const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
  const currentLevelIndex = levels.indexOf(debugConfig.logLevel as LogLevel);
  const messageLevelIndex = levels.indexOf(level);

  return messageLevelIndex <= currentLevelIndex;
}

function internalLog(level: LogLevel, message: string, ...args: unknown[]): void {
  if (isProduction()) {
    return;
  }

  if (shouldLog(level)) {
    const method = getConsoleMethod(level);
    method?.(`[${level.toUpperCase()}] ${message}`, ...args);
  }

  logHistory.push({
    level,
    message,
    timestamp: Date.now(),
    args,
  });

  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.shift();
  }
}

export function resetDebugState(): void {
  debugConfig = { ...defaultDebugConfig };
  featureFlags = {};
  logHistory.length = 0;
  performanceMetrics.length = 0;
  performanceTimers.clear();
}

/**
 * Initialize debug mode.
 * Returns false in production and leaves all debug state untouched.
 */
export function initializeDebugMode(config: Partial<DebugConfig> = {}): boolean {
  if (isProduction()) {
    const warn = getConsoleMethod('warn');
    warn?.('[DEBUG] Debug mode cannot be initialized in production');
    return false;
  }

  debugConfig = {
    ...defaultDebugConfig,
    ...config,
    enabled: true,
  };

  return true;
}

export function isDebugEnabled(): boolean {
  return debugConfig.enabled && !isProduction();
}

export function getDebugConfig(): DebugConfig {
  return { ...debugConfig };
}

export function setLogLevel(level: DebugConfig['logLevel']): void {
  if (isProduction()) {
    return;
  }

  debugConfig.logLevel = level;
}

export function debugLog(message: string, ...args: unknown[]): void {
  internalLog('debug', message, ...args);
}

export function debugInfo(message: string, ...args: unknown[]): void {
  internalLog('info', message, ...args);
}

export function debugWarn(message: string, ...args: unknown[]): void {
  internalLog('warn', message, ...args);
}

export function debugError(message: string, ...args: unknown[]): void {
  internalLog('error', message, ...args);
}

export function getLogHistory(filter?: { level?: LogLevel; limit?: number }): LogEntry[] {
  if (isProduction()) {
    return [];
  }

  let filtered = [...logHistory];

  if (filter?.level) {
    filtered = filtered.filter((entry) => entry.level === filter.level);
  }

  if (filter?.limit) {
    filtered = filtered.slice(-filter.limit);
  }

  return filtered;
}

export function clearLogHistory(): void {
  logHistory.length = 0;
}

export function getDebugInfo(): DebugInfo {
  if (isProduction()) {
    return {
      timestamp: Date.now(),
      environment: 'production',
      debugEnabled: false,
      logLevel: 'silent',
      featureFlagsEnabled: [],
      logCount: 0,
      metricsCount: 0,
    };
  }

  return {
    timestamp: Date.now(),
    environment: 'development',
    debugEnabled: isDebugEnabled(),
    logLevel: debugConfig.logLevel,
    featureFlagsEnabled: Object.entries(featureFlags)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name),
    logCount: logHistory.length,
    metricsCount: performanceMetrics.length,
  };
}

export function captureDebugState(): Record<string, unknown> {
  if (isProduction()) {
    return {
      config: { ...defaultDebugConfig },
      info: getDebugInfo(),
      logs: [],
      metrics: [],
      featureFlags: {},
    };
  }

  return {
    config: getDebugConfig(),
    info: getDebugInfo(),
    logs: getLogHistory({ limit: 50 }),
    metrics: performanceMetrics.slice(-20),
    featureFlags: { ...featureFlags },
  };
}

export function getDevTools(): DevTools {
  return {
    getDebugInfo,
    captureState: captureDebugState,
    triggerBreakpoint: () => {
      if (isDebugEnabled()) {
        debugger; // eslint-disable-line no-debugger
      }
    },
    getMetrics: () => getPerformanceMetrics(),
  };
}

export function registerFeatureFlag(name: string, enabled: boolean = false): void {
  if (isProduction()) {
    return;
  }

  featureFlags[name] = enabled;
  debugLog(`Feature flag registered: ${name} = ${enabled}`);
}

export function isFeatureFlagEnabled(name: string): boolean {
  if (isProduction()) {
    return false;
  }

  return featureFlags[name] ?? false;
}

export function setFeatureFlag(name: string, enabled: boolean): void {
  if (isProduction()) {
    return;
  }

  featureFlags[name] = enabled;
  debugLog(`Feature flag updated: ${name} = ${enabled}`);
}

export function getFeatureFlags(): FeatureFlagSet {
  if (isProduction()) {
    return {};
  }

  return { ...featureFlags };
}

export function resetFeatureFlags(): void {
  if (isProduction()) {
    return;
  }

  featureFlags = {};
  debugLog('Feature flags reset');
}

export function startPerformanceMeasure(name: string): () => PerformanceMetric | null {
  if (!debugConfig.enablePerformanceMonitoring || isProduction()) {
    return () => null;
  }

  const startTime = performance.now();
  performanceTimers.set(name, startTime);

  return () => endPerformanceMeasure(name);
}

export function endPerformanceMeasure(name: string): PerformanceMetric | null {
  if (!debugConfig.enablePerformanceMonitoring || isProduction()) {
    return null;
  }

  const startTime = performanceTimers.get(name);
  if (startTime === undefined) {
    debugWarn(`Performance measure "${name}" was not started`);
    return null;
  }

  const endTime = performance.now();
  const duration = endTime - startTime;

  const metric: PerformanceMetric = {
    name,
    duration,
    timestamp: Date.now(),
  };

  performanceMetrics.push(metric);
  if (performanceMetrics.length > MAX_METRICS_HISTORY) {
    performanceMetrics.shift();
  }

  performanceTimers.delete(name);
  debugLog(`Performance: ${name} took ${duration.toFixed(2)}ms`);

  return metric;
}

export function getPerformanceMetrics(filter?: { name?: string; limit?: number }): PerformanceMetric[] {
  if (isProduction()) {
    return [];
  }

  let filtered = [...performanceMetrics];

  if (filter?.name) {
    filtered = filtered.filter((metric) => metric.name === filter.name);
  }

  if (filter?.limit) {
    filtered = filtered.slice(-filter.limit);
  }

  return filtered;
}

export function clearPerformanceMetrics(): void {
  performanceMetrics.length = 0;
  performanceTimers.clear();
}

export function getPerformanceStats(metricName?: string): {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
} | null {
  if (isProduction()) {
    return null;
  }

  let metrics = performanceMetrics;

  if (metricName) {
    metrics = metrics.filter((metric) => metric.name === metricName);
  }

  if (metrics.length === 0) {
    return null;
  }

  const durations = metrics.map((metric) => metric.duration);

  return {
    count: metrics.length,
    avgDuration: durations.reduce((total, duration) => total + duration, 0) / durations.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
  };
}

export function attachDebugToWindow(): void {
  if (isProduction()) {
    return;
  }

  if (typeof window !== 'undefined') {
    (window as Window & {
      __debug__?: Record<string, unknown>;
    }).__debug__ = {
      init: initializeDebugMode,
      isEnabled: isDebugEnabled,
      getConfig: getDebugConfig,
      setLogLevel,
      log: debugLog,
      info: debugInfo,
      warn: debugWarn,
      error: debugError,
      getLogHistory,
      clearLogHistory,
      getDebugInfo,
      captureState: captureDebugState,
      registerFlag: registerFeatureFlag,
      isFlagEnabled: isFeatureFlagEnabled,
      setFlag: setFeatureFlag,
      getFlags: getFeatureFlags,
      resetFlags: resetFeatureFlags,
      startMeasure: startPerformanceMeasure,
      endMeasure: endPerformanceMeasure,
      getMetrics: getPerformanceMetrics,
      getMetricsStats: getPerformanceStats,
      clearMetrics: clearPerformanceMetrics,
      getDevTools,
    };

    debugLog('Debug tools attached to window.__debug__');
  }
}

export function useDebugLogger(componentName: string) {
  return {
    log: (message: string, ...args: unknown[]) => debugLog(`[${componentName}] ${message}`, ...args),
    info: (message: string, ...args: unknown[]) => debugInfo(`[${componentName}] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) => debugWarn(`[${componentName}] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) =>
      debugError(`[${componentName}] ${message}`, ...args),
  };
}
