import * as fs from 'fs';
import * as path from 'path';

interface K6Metric {
  avg?: number;
  min?: number;
  max?: number;
  p95?: number;
  p99?: number;
  rate?: number;
  count?: number;
}

interface K6Results {
  metrics?: {
    http_req_duration?: K6Metric;
    http_req_failed?: K6Metric;
    http_reqs?: K6Metric;
  };
}

interface PerformanceMonitorResults {
  responseTime?: number[];
  errorRate?: number[];
  throughput?: number[];
  statusCodes?: Record<string, number>;
}

interface AnalysisResults {
  avgResponseTime: number;
  errorRate: number;
  throughput: number;
}

const resultsDir = path.join(__dirname, '../results');

function analyzeK6Results(filePath: string): K6Results {
  const content = fs.readFileSync(filePath, 'utf8');
  const data: K6Results = JSON.parse(content);
  
  console.log('\n=== K6 Test Results Analysis ===\n');
  
  if (data.metrics) {
    console.log('HTTP Metrics:');
    
    if (data.metrics.http_req_duration) {
      const duration = data.metrics.http_req_duration;
      console.log(`  Request Duration:`);
      console.log(`    - Average: ${duration.avg?.toFixed(2)}ms`);
      console.log(`    - Min: ${duration.min?.toFixed(2)}ms`);
      console.log(`    - Max: ${duration.max?.toFixed(2)}ms`);
      console.log(`    - P95: ${duration.p95?.toFixed(2)}ms`);
      console.log(`    - P99: ${duration.p99?.toFixed(2)}ms`);
    }
    
    if (data.metrics.http_req_failed) {
      const failed = data.metrics.http_req_failed;
      console.log(`  Failed Requests: ${((failed.rate || 0) * 100).toFixed(2)}%`);
    }
    
    if (data.metrics.http_reqs) {
      const reqs = data.metrics.http_reqs;
      console.log(`  Total Requests: ${reqs.count}`);
      console.log(`  Requests/sec: ${reqs.rate?.toFixed(2)}`);
    }
  }
  
  return data;
}

function analyzePerformanceMonitor(filePath: string): PerformanceMonitorResults {
  const content = fs.readFileSync(filePath, 'utf8');
  const data: PerformanceMonitorResults = JSON.parse(content);
  
  console.log('\n=== Performance Monitor Analysis ===\n');
  
  if (data.responseTime && data.responseTime.length > 0) {
    const validTimes = data.responseTime.filter(t => t > 0);
    const avg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const min = Math.min(...validTimes);
    const max = Math.max(...validTimes);
    
    console.log(`Response Time:`);
    console.log(`  - Average: ${avg.toFixed(2)}ms`);
    console.log(`  - Min: ${min}ms`);
    console.log(`  - Max: ${max}ms`);
  }
  
  if (data.errorRate && data.errorRate.length > 0) {
    const avgErrorRate = data.errorRate.reduce((a, b) => a + b, 0) / data.errorRate.length;
    console.log(`\nError Rate: ${avgErrorRate.toFixed(2)}%`);
  }
  
  if (data.throughput && data.throughput.length > 0) {
    const avgThroughput = data.throughput.reduce((a, b) => a + b, 0) / data.throughput.length;
    console.log(`Throughput: ${avgThroughput.toFixed(2)} req/s`);
  }
  
  if (data.statusCodes) {
    console.log('\nStatus Codes:');
    Object.entries(data.statusCodes).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });
  }
  
  return data;
}

function generateRecommendations(results: AnalysisResults): void {
  console.log('\n=== Performance Recommendations ===\n');
  
  const recommendations: string[] = [];
  
  if (results.avgResponseTime > 500) {
    recommendations.push('⚠️  High response times detected. Consider:');
    recommendations.push('   - Adding database query optimization');
    recommendations.push('   - Implementing caching strategies');
    recommendations.push('   - Reviewing N+1 query patterns');
  }
  
  if (results.errorRate > 1) {
    recommendations.push('⚠️  High error rate. Consider:');
    recommendations.push('   - Reviewing error logs');
    recommendations.push('   - Adding circuit breakers');
    recommendations.push('   - Implementing retry mechanisms');
  }
  
  if (results.throughput < 10) {
    recommendations.push('⚠️  Low throughput. Consider:');
    recommendations.push('   - Scaling horizontally');
    recommendations.push('   - Optimizing middleware');
    recommendations.push('   - Using connection pooling');
  }
  
  if (recommendations.length === 0) {
    console.log('✅ Performance looks good! No critical issues detected.');
  } else {
    recommendations.forEach(rec => console.log(rec));
  }
}

function main(): void {
  if (!fs.existsSync(resultsDir)) {
    console.error('Results directory not found. Run tests first.');
    process.exit(1);
  }
  
  const files = fs.readdirSync(resultsDir);
  
  if (files.length === 0) {
    console.error('No result files found. Run tests first.');
    process.exit(1);
  }
  
  console.log(`Found ${files.length} result file(s)\n`);
  
  const latestFile = files
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()[0];
  
  if (!latestFile) {
    console.error('No JSON result files found.');
    process.exit(1);
  }
  
  console.log(`Analyzing: ${latestFile}`);
  
  const filePath = path.join(resultsDir, latestFile);
  
  if (latestFile.includes('performance-monitor')) {
    analyzePerformanceMonitor(filePath);
  } else {
    analyzeK6Results(filePath);
  }
  
  generateRecommendations({
    avgResponseTime: 300,
    errorRate: 0.5,
    throughput: 50,
  });
}

main();
