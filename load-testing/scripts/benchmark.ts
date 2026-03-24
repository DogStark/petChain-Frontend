import * as http from 'http';
import * as https from 'https';

interface BenchmarkConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  requests: number;
  concurrency: number;
}

interface BenchmarkResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTime: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  responseTimes: number[];
}

class Benchmark {
  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    console.log(`\n🚀 Starting benchmark...`);
    console.log(`URL: ${config.url}`);
    console.log(`Requests: ${config.requests}`);
    console.log(`Concurrency: ${config.concurrency}\n`);

    const results: BenchmarkResult = {
      totalRequests: config.requests,
      successfulRequests: 0,
      failedRequests: 0,
      totalTime: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      responseTimes: [],
    };

    const startTime = Date.now();
    const promises: Promise<void>[] = [];

    for (let i = 0; i < config.requests; i++) {
      if (i % config.concurrency === 0 && i > 0) {
        await Promise.all(promises);
        promises.length = 0;
      }

      promises.push(this.makeRequest(config, results));
    }

    await Promise.all(promises);

    results.totalTime = Date.now() - startTime;
    results.avgResponseTime = 
      results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
    results.requestsPerSecond = (results.successfulRequests / results.totalTime) * 1000;

    this.printResults(results);
    return results;
  }

  private makeRequest(config: BenchmarkConfig, results: BenchmarkResult): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const client = config.url.startsWith('https') ? https : http;

      const req = client.request(config.url, {
        method: config.method,
        headers: config.headers,
      }, (res) => {
        const duration = Date.now() - startTime;
        
        results.responseTimes.push(duration);
        results.minResponseTime = Math.min(results.minResponseTime, duration);
        results.maxResponseTime = Math.max(results.maxResponseTime, duration);

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          results.successfulRequests++;
        } else {
          results.failedRequests++;
        }

        res.on('data', () => {});
        res.on('end', () => resolve());
      });

      req.on('error', () => {
        results.failedRequests++;
        resolve();
      });

      if (config.body) {
        req.write(config.body);
      }

      req.end();
    });
  }

  private printResults(results: BenchmarkResult): void {
    console.log('\n📊 Benchmark Results\n');
    console.log(`Total Requests:      ${results.totalRequests}`);
    console.log(`Successful:          ${results.successfulRequests}`);
    console.log(`Failed:              ${results.failedRequests}`);
    console.log(`Total Time:          ${results.totalTime}ms`);
    console.log(`Avg Response Time:   ${results.avgResponseTime.toFixed(2)}ms`);
    console.log(`Min Response Time:   ${results.minResponseTime}ms`);
    console.log(`Max Response Time:   ${results.maxResponseTime}ms`);
    console.log(`Requests/sec:        ${results.requestsPerSecond.toFixed(2)}`);
    
    // Calculate percentiles
    const sorted = results.responseTimes.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    console.log(`\nPercentiles:`);
    console.log(`  P50: ${p50}ms`);
    console.log(`  P95: ${p95}ms`);
    console.log(`  P99: ${p99}ms`);
  }
}

// CLI usage
const benchmark = new Benchmark();

const config: BenchmarkConfig = {
  url: process.env.BENCHMARK_URL || 'http://localhost:3000/api/v1/health',
  method: 'GET',
  requests: parseInt(process.env.REQUESTS || '1000'),
  concurrency: parseInt(process.env.CONCURRENCY || '10'),
};

benchmark.run(config);
