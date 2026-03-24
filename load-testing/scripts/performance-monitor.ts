import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

interface MonitorConfig {
  apiUrl: string;
  interval: number;
  outputDir: string;
}

interface Metrics {
  timestamp: string[];
  responseTime: number[];
  statusCodes: Record<number, number>;
  errorRate: number[];
  throughput: number[];
}

const config: MonitorConfig = {
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  interval: parseInt(process.env.MONITOR_INTERVAL || '5000'),
  outputDir: path.join(__dirname, '../results'),
};

const metrics: Metrics = {
  timestamp: [],
  responseTime: [],
  statusCodes: {},
  errorRate: [],
  throughput: [],
};

let requestCount = 0;
let errorCount = 0;
let lastRequestCount = 0;

function makeRequest(): Promise<{ duration: number; statusCode: number; error?: string }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const req = http.get(`${config.apiUrl}/api/v1/health`, (res) => {
      const duration = Date.now() - startTime;
      requestCount++;
      
      const statusCode = res.statusCode || 0;
      metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;
      
      if (statusCode >= 400) {
        errorCount++;
      }
      
      resolve({ duration, statusCode });
    });

    req.on('error', (err) => {
      errorCount++;
      requestCount++;
      resolve({ duration: -1, statusCode: 0, error: err.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      errorCount++;
      requestCount++;
      resolve({ duration: -1, statusCode: 0, error: 'timeout' });
    });
  });
}

async function collectMetrics(): Promise<void> {
  const result = await makeRequest();
  
  metrics.timestamp.push(new Date().toISOString());
  metrics.responseTime.push(result.duration);
  
  const currentErrorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
  metrics.errorRate.push(currentErrorRate);
  
  const throughput = ((requestCount - lastRequestCount) / (config.interval / 1000));
  metrics.throughput.push(throughput);
  lastRequestCount = requestCount;
  
  console.log(
    `[${new Date().toISOString()}] Response: ${result.duration}ms | ` +
    `Status: ${result.statusCode} | Error Rate: ${currentErrorRate.toFixed(2)}% | ` +
    `Throughput: ${throughput.toFixed(2)} req/s`
  );
}

function saveMetrics(): void {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
  
  const filename = path.join(config.outputDir, `performance-monitor-${Date.now()}.json`);
  fs.writeFileSync(filename, JSON.stringify(metrics, null, 2));
  console.log(`\nMetrics saved to: ${filename}`);
}

async function monitor(): Promise<void> {
  console.log('Starting performance monitoring...');
  console.log(`API URL: ${config.apiUrl}`);
  console.log(`Interval: ${config.interval}ms\n`);
  
  const interval = setInterval(collectMetrics, config.interval);
  
  process.on('SIGINT', () => {
    clearInterval(interval);
    saveMetrics();
    console.log('\nMonitoring stopped.');
    process.exit(0);
  });
}

monitor();
