import fs from 'node:fs';

const args = process.argv.slice(2);
const summaryPath = args[0];
const baselinePath = args[1];
const toleranceArg = args[2];
const summaryOnly = args.includes('--summary-only');

if (!summaryPath || !baselinePath) {
  console.error('Usage: node performance/scripts/compare-baseline.mjs <summary.json> <baseline.json> [tolerance] [--summary-only]');
  process.exit(1);
}

const tolerance = Number.isFinite(Number(toleranceArg)) ? Number(toleranceArg) : 0.15;

const readJson = (path) => {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing file: ${path}`);
  }
  return JSON.parse(fs.readFileSync(path, 'utf8'));
};

const getMetric = (summary, metricName, field) => {
  const value = summary?.metrics?.[metricName]?.values?.[field];
  return typeof value === 'number' ? value : null;
};

const current = readJson(summaryPath);
const baseline = readJson(baselinePath);

const checks = [
  {
    label: 'http_req_failed.rate',
    metricName: 'http_req_failed',
    field: 'rate',
    higherIsWorse: true,
  },
  {
    label: 'http_req_duration.p(95)',
    metricName: 'http_req_duration',
    field: 'p(95)',
    higherIsWorse: true,
  },
  {
    label: 'frontend_page_duration.p(95)',
    metricName: 'frontend_page_duration',
    field: 'p(95)',
    higherIsWorse: true,
  },
  {
    label: 'api_request_duration.p(95)',
    metricName: 'api_request_duration',
    field: 'p(95)',
    higherIsWorse: true,
  },
];

const lines = ['| Metric | Baseline | Current | Delta | Allowed Max | Status |', '| --- | ---: | ---: | ---: | ---: | :---: |'];
let failures = 0;

for (const check of checks) {
  const baselineValue = getMetric(baseline, check.metricName, check.field);
  const currentValue = getMetric(current, check.metricName, check.field);

  if (baselineValue == null || currentValue == null) {
    lines.push(`| ${check.label} | n/a | n/a | n/a | n/a | ⚠️ |`);
    continue;
  }

  const allowedMax = baselineValue * (1 + tolerance);
  const deltaPercent = baselineValue === 0 ? 0 : ((currentValue - baselineValue) / baselineValue) * 100;
  const regressed = check.higherIsWorse ? currentValue > allowedMax : currentValue < baselineValue * (1 - tolerance);

  if (regressed) failures += 1;

  lines.push(
    `| ${check.label} | ${baselineValue.toFixed(3)} | ${currentValue.toFixed(3)} | ${deltaPercent.toFixed(2)}% | ${allowedMax.toFixed(3)} | ${regressed ? '❌' : '✅'} |`,
  );
}

const summaryText = lines.join('\n');
console.log(summaryText);

if (!summaryOnly && failures > 0) {
  console.error(`\nPerformance regression detected in ${failures} metric(s).`);
  process.exit(1);
}
