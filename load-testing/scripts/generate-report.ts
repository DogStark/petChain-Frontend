import * as fs from 'fs';
import * as path from 'path';

interface ReportData {
  testName: string;
  timestamp: string;
  duration: number;
  totalRequests: number;
  successRate: number;
  errorRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
}

const resultsDir = path.join(__dirname, '../results');
const reportsDir = path.join(__dirname, '../reports');

function generateMarkdownReport(data: ReportData): string {
  const status = data.errorRate < 1 && data.p95ResponseTime < 500 ? '✅ PASS' : '❌ FAIL';
  
  return `# Load Test Report

## Test Information

- **Test Name**: ${data.testName}
- **Timestamp**: ${data.timestamp}
- **Duration**: ${data.duration}s
- **Status**: ${status}

## Results Summary

### Request Statistics
- **Total Requests**: ${data.totalRequests.toLocaleString()}
- **Success Rate**: ${data.successRate.toFixed(2)}%
- **Error Rate**: ${data.errorRate.toFixed(2)}%
- **Throughput**: ${data.throughput.toFixed(2)} req/s

### Response Times
- **Average**: ${data.avgResponseTime.toFixed(2)}ms
- **P95**: ${data.p95ResponseTime.toFixed(2)}ms
- **P99**: ${data.p99ResponseTime.toFixed(2)}ms

## Performance Analysis

### Thresholds

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P95 Response Time | < 500ms | ${data.p95ResponseTime.toFixed(0)}ms | ${data.p95ResponseTime < 500 ? '✅' : '❌'} |
| P99 Response Time | < 1000ms | ${data.p99ResponseTime.toFixed(0)}ms | ${data.p99ResponseTime < 1000 ? '✅' : '❌'} |
| Error Rate | < 1% | ${data.errorRate.toFixed(2)}% | ${data.errorRate < 1 ? '✅' : '❌'} |
| Throughput | > 50 req/s | ${data.throughput.toFixed(1)} req/s | ${data.throughput > 50 ? '✅' : '❌'} |

## Recommendations

${generateRecommendations(data)}

## Next Steps

${generateNextSteps(data)}

---
*Generated on ${new Date().toISOString()}*
`;
}

function generateRecommendations(data: ReportData): string {
  const recommendations: string[] = [];
  
  if (data.p95ResponseTime > 500) {
    recommendations.push('- 🔴 **High Response Times**: Implement caching, optimize database queries, add indexes');
  }
  
  if (data.errorRate > 1) {
    recommendations.push('- 🔴 **High Error Rate**: Review error logs, add retry logic, implement circuit breakers');
  }
  
  if (data.throughput < 50) {
    recommendations.push('- 🔴 **Low Throughput**: Scale horizontally, optimize middleware, increase connection pool');
  }
  
  if (data.p95ResponseTime > 300 && data.p95ResponseTime <= 500) {
    recommendations.push('- 🟡 **Moderate Response Times**: Consider adding caching for frequently accessed data');
  }
  
  if (recommendations.length === 0) {
    return '✅ **Performance is excellent!** No critical issues detected. Continue monitoring.';
  }
  
  return recommendations.join('\n');
}

function generateNextSteps(data: ReportData): string {
  if (data.errorRate < 1 && data.p95ResponseTime < 500) {
    return `1. Continue monitoring performance
2. Run stress tests to find limits
3. Document baseline metrics
4. Set up continuous monitoring`;
  }
  
  return `1. Review detailed logs for errors
2. Apply recommended optimizations
3. Re-run tests to validate improvements
4. Update performance baselines`;
}

function parseK6Summary(filePath: string): ReportData | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    return {
      testName: path.basename(filePath, '.json'),
      timestamp: new Date().toISOString(),
      duration: data.state?.testRunDurationMs / 1000 || 0,
      totalRequests: data.metrics?.http_reqs?.count || 0,
      successRate: ((1 - (data.metrics?.http_req_failed?.rate || 0)) * 100),
      errorRate: (data.metrics?.http_req_failed?.rate || 0) * 100,
      avgResponseTime: data.metrics?.http_req_duration?.avg || 0,
      p95ResponseTime: data.metrics?.http_req_duration?.p95 || 0,
      p99ResponseTime: data.metrics?.http_req_duration?.p99 || 0,
      throughput: data.metrics?.http_reqs?.rate || 0,
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return null;
  }
}

function main(): void {
  if (!fs.existsSync(resultsDir)) {
    console.error('Results directory not found. Run tests first.');
    process.exit(1);
  }

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const files = fs.readdirSync(resultsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('No result files found. Run tests first.');
    process.exit(1);
  }

  console.log(`\n📊 Generating reports for ${files.length} test result(s)...\n`);

  files.forEach(file => {
    const filePath = path.join(resultsDir, file);
    const data = parseK6Summary(filePath);
    
    if (data) {
      const report = generateMarkdownReport(data);
      const reportPath = path.join(reportsDir, `${path.basename(file, '.json')}-report.md`);
      
      fs.writeFileSync(reportPath, report);
      console.log(`✅ Generated: ${reportPath}`);
    }
  });

  console.log(`\n✨ Report generation complete!\n`);
}

main();
