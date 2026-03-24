# Bottleneck Identification Guide

## Overview

This guide helps identify and resolve performance bottlenecks in the PetChain application.

## Identification Methods

### 1. Load Testing Analysis

Run load tests and analyze results:
```bash
npm run test:load
npm run analyze
```

Look for:
- High P95/P99 latencies (> 500ms)
- Error rates > 1%
- Failed requests
- Timeout errors

### 2. Real-time Monitoring

```bash
npm run monitor
```

Watch for:
- Increasing response times
- Memory growth
- CPU spikes
- Error rate increases

### 3. Database Query Analysis

Enable slow query logging in PostgreSQL:
```sql
-- Log queries taking > 100ms
ALTER DATABASE petchain_db SET log_min_duration_statement = 100;

-- View slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

### 4. Application Profiling

Use Node.js profiler:
```bash
node --prof dist/main.js
node --prof-process isolate-*.log > profile.txt
```

## Common Bottlenecks

### Database Bottlenecks

**Symptoms:**
- Slow query execution
- High database CPU
- Connection pool exhaustion

**Solutions:**
1. Add missing indexes
2. Optimize N+1 queries
3. Increase connection pool size
4. Use read replicas
5. Implement query result caching

**Example Fix:**
```typescript
// Before (N+1 problem)
const pets = await this.petRepository.find();
for (const pet of pets) {
  pet.vaccinations = await this.vaccinationRepository.find({ 
    where: { petId: pet.id } 
  });
}

// After (optimized)
const pets = await this.petRepository.find({
  relations: ['vaccinations'],
});
```

### Memory Bottlenecks

**Symptoms:**
- Increasing heap usage
- Out of memory errors
- Slow garbage collection

**Solutions:**
1. Fix memory leaks
2. Implement streaming for large data
3. Limit response payload sizes
4. Use pagination
5. Clear event listeners

**Example Fix:**
```typescript
// Before (loads all in memory)
const allPets = await this.petRepository.find();
return allPets;

// After (paginated)
const [pets, total] = await this.petRepository.findAndCount({
  skip: (page - 1) * limit,
  take: limit,
});
return { pets, total };
```

### CPU Bottlenecks

**Symptoms:**
- High CPU usage
- Slow request processing
- Increased response times

**Solutions:**
1. Offload heavy computations to workers
2. Use caching for expensive operations
3. Optimize algorithms
4. Implement rate limiting
5. Scale horizontally

**Example Fix:**
```typescript
// Before (synchronous heavy operation)
const processed = this.processImage(largeImage);

// After (async queue)
await this.queue.add('process-image', { imageId });
return { status: 'processing' };
```

### Network Bottlenecks

**Symptoms:**
- Slow external API calls
- High latency
- Timeout errors

**Solutions:**
1. Implement connection pooling
2. Add request timeouts
3. Use circuit breakers
4. Cache external API responses
5. Use CDN for static assets

**Example Fix:**
```typescript
// Add timeout and retry
const response = await axios.get(url, {
  timeout: 5000,
  retry: 3,
});
```

## Profiling Tools

### k6 Profiling
```bash
k6 run --out json=results.json tests/load-test.js
```

### Node.js Profiling
```bash
# CPU profiling
node --prof dist/main.js

# Memory profiling
node --inspect dist/main.js
# Then use Chrome DevTools
```

### Database Profiling
```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View query statistics
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

## Metrics to Track

### Application Metrics
- Request rate (req/s)
- Response time (P50, P95, P99)
- Error rate (%)
- Active connections

### Database Metrics
- Query execution time
- Connection pool usage
- Cache hit ratio
- Slow query count

### System Metrics
- CPU usage (%)
- Memory usage (MB)
- Disk I/O
- Network throughput

### Business Metrics
- Active users
- API calls per endpoint
- Feature usage
- User session duration

## Action Plan

1. **Baseline**: Run load tests to establish baseline
2. **Identify**: Use monitoring to find bottlenecks
3. **Prioritize**: Focus on highest impact issues
4. **Optimize**: Implement fixes
5. **Validate**: Re-run tests to confirm improvements
6. **Monitor**: Set up continuous monitoring

## Quick Checks

```bash
# Check database connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis memory
redis-cli INFO memory

# Check Node.js memory
curl http://localhost:3000/api/v1/health/metrics

# Run quick load test
k6 run --vus 10 --duration 30s tests/load-test.js
```

## Resources

- [PostgreSQL Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [k6 Documentation](https://k6.io/docs/)
- [Redis Performance](https://redis.io/docs/management/optimization/)
