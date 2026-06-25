import assert from 'assert';

import {
  PERFORMANCE_BUDGETS,
  checkBudget,
  formatMetricValue,
  getRating,
  type WebVitalMetric,
} from './webVitalsReporter';

function assertRating(value: number, metric: string, expected: string) {
  const result = getRating(value, metric);
  assert.strictEqual(result, expected, `getRating(${value}, '${metric}') should be '${expected}', got '${result}'`);
}

function assertCheckBudget(metric: WebVitalMetric, expected: boolean) {
  const result = checkBudget(metric);
  assert.strictEqual(result, expected, `checkBudget(${metric.name}=${metric.value}) should be ${expected}, got ${result}`);
}

function assertFormat(metric: string, value: number, expected: string) {
  const result = formatMetricValue(metric, value);
  assert.strictEqual(result, expected, `formatMetricValue('${metric}', ${value}) should be '${expected}', got '${result}'`);
}

// getRating tests
assertRating(1500, 'LCP', 'good');
assertRating(3000, 'LCP', 'needs-improvement');
assertRating(5000, 'LCP', 'poor');
assertRating(0.05, 'CLS', 'good');
assertRating(0.15, 'CLS', 'needs-improvement');
assertRating(0.3, 'CLS', 'poor');
assertRating(100, 'INP', 'good');
assertRating(100, 'UNKNOWN', 'needs-improvement');

// checkBudget tests
assertCheckBudget({ name: 'LCP', value: 1500, rating: 'good', delta: 1500, id: '1', navigationType: 'navigate' }, true);
assertCheckBudget({ name: 'LCP', value: 5000, rating: 'poor', delta: 5000, id: '1', navigationType: 'navigate' }, false);
assertCheckBudget({ name: 'UNKNOWN' as any, value: 999, rating: 'needs-improvement', delta: 999, id: '1', navigationType: 'navigate' }, true);

// formatMetricValue tests
assertFormat('CLS', 0.12345, '0.123');
assertFormat('LCP', 2500, '2500 ms');
assertFormat('FID', 50, '50 ms');
assertFormat('TTFB', 800, '800 ms');
assertFormat('INP', 200, '200 ms');
assertFormat('FCP', 1800, '1800 ms');

// PERFORMANCE_BUDGETS tests
const metrics = PERFORMANCE_BUDGETS.map((b) => b.metric);
assert.ok(metrics.includes('LCP'), 'Should include LCP');
assert.ok(metrics.includes('FID'), 'Should include FID');
assert.ok(metrics.includes('CLS'), 'Should include CLS');
assert.ok(metrics.includes('TTFB'), 'Should include TTFB');
assert.ok(metrics.includes('INP'), 'Should include INP');
assert.ok(metrics.includes('FCP'), 'Should include FCP');

for (const budget of PERFORMANCE_BUDGETS) {
  assert.ok(budget.good > 0, `${budget.metric}.good should be > 0`);
  assert.ok(budget.needsImprovement > budget.good, `${budget.metric}.needsImprovement should be > .good`);
}

console.log('All web vitals reporter tests passed!');
