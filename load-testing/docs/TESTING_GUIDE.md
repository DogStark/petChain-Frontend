# Load Testing Guide

## Quick Start

### 1. Setup

```bash
cd load-testing
npm install
npm run build
```

### 2. Configure Test Users

Create test users in your database or use existing ones:

```bash
cp .env.example .env
# Edit .env with your test credentials
```

### 3. Start Backend

```bash
cd ../backend
npm run start:dev
```

### 4. Run Tests

```bash
cd ../load-testing

# Quick smoke test
npm run test:load

# Full test suite
npm run test:all
```

## Test Scenarios

### Load Test (Baseline)
**Purpose**: Establish baseline performance under normal load

**Configuration**:
- Duration: 9 minutes
- Users: 0 → 10 → 0
- Expected: All requests succeed, P95 < 500ms

**Run**:
```bash
npm run test:load
```

### Stress Test (Breaking Point)
**Purpose**: Find system limits and breaking points

**Configuration**:
- Duration: 16 minutes
- Users: 0 → 10 → 50 → 100 → 0
- Expected: Graceful degradation, error rate < 5%

**Run**:
```bash
npm run test:stress
```

### Spike Test (Traffic Surge)
**Purpose**: Test recovery from sudden traffic spikes

**Configuration**:
- Duration: 5 minutes
- Users: 10 → 200 (sudden) → 10
- Expected: System recovers, no crashes

**Run**:
```bash
npm run test:spike
```

### Soak Test (Endurance)
**Purpose**: Detect memory leaks and degradation over time

**Configuration**:
- Duration: 3+ hours
- Users: Sustained 20
- Expected: Stable performance, no memory leaks

**Run**:
```bash
npm run test:soak
```

### API Endpoints Test
**Purpose**: Test all major API endpoints

**Run**:
```bash
npm run test:api
```

### Auth Flow Test
**Purpose**: Test authentication performance

**Run**:
```bash
npm run test:auth
```

### Pets Workflow Test
**Purpose**: Test complete CRUD operations

**Run**:
```bash
npm run test:pets
```

### Database Test
**Purpose**: Test database-heavy operations

**Run**:
```bash
npm run test:database
```

## Interpreting Results

### Success Criteria

✅ **Good Performance**:
- P95 response time < 500ms
- P99 response time < 1000ms
- Error rate < 1%
- No timeouts
- Stable memory usage

⚠️ **Needs Optimization**:
- P95 response time 500-1000ms
- Error rate 1-5%
- Occasional timeouts
- Gradual memory increase

❌ **Critical Issues**:
- P95 response time > 1000ms
- Error rate > 5%
- Frequent timeouts
- Memory leaks
- Service crashes

### Key Metrics

**Response Time Percentiles**:
- P50 (median): Typical user experience
- P95: 95% of requests faster than this
- P99: 99% of requests faster than this

**Error Rate**:
- < 0.1%: Excellent
- 0.1-1%: Good
- 1-5%: Needs attention
- > 5%: Critical

**Throughput**:
- Requests per second the system can handle
- Should remain stable under load

## Monitoring During Tests

### Real-time Monitoring

Terminal 1 - Run test:
```bash
npm run test:load
```

Terminal 2 - Monitor performance:
```bash
npm run monitor
```

Terminal 3 - Watch logs:
```bash
cd ../backend
tail -f logs/application.log
```

### Dashboard

Launch the performance dashboard:
```bash
npm run dashboard
```

Open http://localhost:3001 to view real-time metrics.

## Analyzing Results

After running tests:

```bash
npm run analyze
```

This will:
- Parse test results
- Calculate statistics
- Identify bottlenecks
- Provide recommendations

## Custom Test Scenarios

### Create Custom Test

```typescript
// tests/custom-test.ts
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Options } from 'k6/options';
import { config, getApiUrl } from '../config/test-config';
import { login, getAuthHeaders } from '../utils/auth-helper';

export const options: Options = {
  vus: 10,
  duration: '5m',
};

export function setup() {
  return { auth: login('user@test.com', 'password') };
}

export default function(data) {
  const headers = getAuthHeaders(data.auth.accessToken);
  
  const response = http.get(getApiUrl('/your-endpoint'), { headers });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  
  sleep(1);
}
```

### Run Custom Test

```bash
npm run build
k6 run dist/tests/custom-test.js
```

## Environment Variables

```bash
# API Configuration
BASE_URL=http://localhost:3000
API_PREFIX=api/v1

# Test Users
PET_OWNER_EMAIL=owner@test.com
PET_OWNER_PASSWORD=Test123!@#

# Thresholds
THRESHOLD_P95=500
THRESHOLD_P99=1000
```

## CI/CD Integration

Tests run automatically via GitHub Actions:

**Manual Trigger**:
1. Go to Actions tab
2. Select "Load Testing" workflow
3. Click "Run workflow"
4. Choose test type

**Scheduled**:
- Runs weekly on Sunday at 2 AM

## Troubleshooting

### k6 not installed

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

### Connection refused

Ensure backend is running:
```bash
curl http://localhost:3000/api/v1/health
```

### Authentication failures

Verify test users exist:
```bash
# Create test user via API or database
```

### High error rates

Check backend logs:
```bash
cd backend
npm run start:dev
# Watch for errors
```

## Best Practices

1. **Start Small**: Begin with smoke tests (1 VU)
2. **Baseline First**: Establish baseline before optimization
3. **Isolate Changes**: Test one optimization at a time
4. **Monitor Resources**: Watch CPU, memory, database
5. **Test Realistic Scenarios**: Match production patterns
6. **Document Results**: Keep history of improvements

## Next Steps

1. Run baseline tests
2. Identify bottlenecks
3. Implement optimizations (see PERFORMANCE_OPTIMIZATION.md)
4. Re-test and compare
5. Set up continuous monitoring
