# PetChain Load Testing & Performance Optimization

Comprehensive load testing and performance optimization suite for the PetChain application.

## Overview

This suite provides automated load testing, performance monitoring, and optimization strategies using k6 and custom monitoring tools.

## Prerequisites

- Node.js 20+
- k6 installed ([Installation Guide](https://k6.io/docs/get-started/installation/))
- Running PetChain backend instance
- Test user accounts configured

## Installation

```bash
cd load-testing
npm install
npm run build
```

## Test Types

### 1. Load Test
Tests normal expected load conditions.
```bash
npm run test:load
```
- Duration: 9 minutes
- VUs: Ramps from 0 → 10 → 0
- Purpose: Baseline performance validation

### 2. Stress Test
Tests system behavior under heavy load.
```bash
npm run test:stress
```
- Duration: 16 minutes
- VUs: Ramps from 0 → 10 → 50 → 100 → 0
- Purpose: Find breaking points

### 3. Spike Test
Tests sudden traffic spikes.
```bash
npm run test:spike
```
- Duration: ~5 minutes
- VUs: Sudden spike to 200
- Purpose: Validate auto-scaling and recovery

### 4. Soak Test
Tests system stability over extended periods.
```bash
npm run test:soak
```
- Duration: 3+ hours
- VUs: Sustained 20 users
- Purpose: Detect memory leaks and degradation

### 5. API Endpoints Test
Tests all major API endpoints.
```bash
npm run test:api
```

### 6. Auth Flow Test
Tests authentication workflows.
```bash
npm run test:auth
```

### 7. Pets Workflow Test
Tests complete pet CRUD operations.
```bash
npm run test:pets
```

## Configuration

Set environment variables in `.env` or export them:

```bash
export BASE_URL=http://localhost:3000
export API_PREFIX=api/v1
export PET_OWNER_EMAIL=owner@test.com
export PET_OWNER_PASSWORD=Test123!@#
```

## Performance Monitoring

### Real-time Monitoring
```bash
npm run monitor
```

Monitors API health endpoint every 5 seconds and collects:
- Response times
- Error rates
- Throughput
- Status code distribution

### Results Analysis
```bash
npm run analyze
```

Analyzes test results and provides recommendations.

### Performance Dashboard
```bash
npm run dashboard
```

Launches web dashboard at `http://localhost:3001` with:
- Real-time metrics visualization
- Historical test results
- WebSocket updates

## Performance Thresholds

Default thresholds configured:
- P95 response time: < 500ms
- P99 response time: < 1000ms
- Error rate: < 1%
- Auth endpoints: < 300ms
- Search endpoints: < 800ms

## Results

Test results are saved to `load-testing/results/` directory in JSON format.

## CI/CD Integration

GitHub Actions workflow available at `.github/workflows/load-testing.yml`:
- Manual trigger with test type selection
- Scheduled weekly runs
- Automatic result archiving

## Optimization Strategies

See `PERFORMANCE_OPTIMIZATION.md` for detailed optimization strategies including:
- Database query optimization
- Caching strategies
- Connection pooling
- Rate limiting
- Horizontal scaling

## Troubleshooting

### k6 not found
Install k6: https://k6.io/docs/get-started/installation/

### Connection refused
Ensure backend is running on the configured BASE_URL.

### Authentication failures
Verify test user credentials exist in the database.

## Support

For issues or questions, refer to the main project documentation.
