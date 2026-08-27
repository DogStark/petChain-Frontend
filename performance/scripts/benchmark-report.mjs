import fs from 'node:fs';

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: node performance/scripts/benchmark-report.mjs <summary.json>');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const metrics = summary.metrics ?? {};

const formatMetric = (name, field, suffix = '') => {
  const value = metrics[name]?.values?.[field];
  if (value === undefined) {
    return 'n/a';
  }

  if (typeof value === 'number') {
    return `${value.toFixed(2)}${suffix}`;
  }

  return `${value}${suffix}`;
};

const report = [
  '| Metric | Value |',
  '| --- | ---: |',
  `| HTTP failures | ${formatMetric('http_req_failed', 'rate', '%')} |`,
  `| HTTP request p95 | ${formatMetric('http_req_duration', 'p(95)', ' ms')} |`,
  `| Frontend p95 | ${formatMetric('frontend_page_duration', 'p(95)', ' ms')} |`,
  `| API p95 | ${formatMetric('api_request_duration', 'p(95)', ' ms')} |`,
  `| Iterations | ${formatMetric('iterations', 'count')} |`,
  `| VUs max | ${formatMetric('vus_max', 'value')} |`,
].join('\n');

console.log(report);