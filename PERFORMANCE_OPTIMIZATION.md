# Performance Optimization Guide

Comprehensive performance optimization strategies for PetChain.

## Table of Contents
1. [Database Optimization](#database-optimization)
2. [Caching Strategies](#caching-strategies)
3. [API Optimization](#api-optimization)
4. [Infrastructure Scaling](#infrastructure-scaling)
5. [Monitoring & Alerting](#monitoring--alerting)

## Database Optimization

### Query Optimization

#### Add Indexes
```sql
-- Pet queries
CREATE INDEX idx_pets_owner_id ON pets(owner_id);
CREATE INDEX idx_pets_species ON pets(species);
CREATE INDEX idx_pets_created_at ON pets(created_at DESC);

-- Vaccination queries
CREATE INDEX idx_vaccinations_pet_id ON vaccinations(pet_id);
CREATE INDEX idx_vaccinations_date ON vaccinations(vaccination_date DESC);

-- Medical records
CREATE INDEX idx_medical_records_pet_id ON medical_records(pet_id);
CREATE INDEX idx_medical_records_date ON medical_records(record_date DESC);

-- Search optimization
CREATE INDEX idx_pets_name_trgm ON pets USING gin(name gin_trgm_ops);
CREATE INDEX idx_breeds_name_trgm ON breeds USING gin(name gin_trgm_ops);
```

#### Connection Pooling
```typescript
// database.config.ts
export default {
  type: 'postgres',
  poolSize: 20,
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
};
```

#### Query Optimization Patterns
- Use `select` to limit returned fields
- Implement pagination for large datasets
- Use `leftJoinAndSelect` sparingly
- Avoid N+1 queries with proper eager loading

### Database Monitoring
```typescript
// Enable query logging for slow queries
logging: ['error', 'warn', 'schema'],
maxQueryExecutionTime: 1000, // Log queries > 1s
```

## Caching Strategies

### Redis Caching

#### Cache Configuration
```typescript
// app.module.ts
CacheModule.register({
  isGlobal: true,
  store: redisStore,
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  ttl: 300, // 5 minutes default
  max: 1000, // Max items in cache
});
```

#### Cache Patterns

**Read-Through Cache**
```typescript
async getPet(id: string) {
  const cacheKey = `pet:${id}`;
  const cached = await this.cacheManager.get(cacheKey);
  
  if (cached) return cached;
  
  const pet = await this.petRepository.findOne({ where: { id } });
  await this.cacheManager.set(cacheKey, pet, 600);
  
  return pet;
}
```

**Cache Invalidation**
```typescript
async updatePet(id: string, data: UpdatePetDto) {
  const pet = await this.petRepository.save({ id, ...data });
  
  // Invalidate related caches
  await this.cacheManager.del(`pet:${id}`);
  await this.cacheManager.del(`pets:owner:${pet.ownerId}`);
  
  return pet;
}
```

### Cache Layers

1. **Application Cache** (Redis): API responses, computed data
2. **Database Cache**: Query result cache
3. **CDN Cache**: Static assets, images
4. **Browser Cache**: Client-side caching headers

## API Optimization

### Response Compression

Enable gzip compression:
```typescript
// main.ts
import * as compression from 'compression';
app.use(compression());
```

### Rate Limiting

```typescript
// rate-limit.guard.ts
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = `rate-limit:${request.ip}`;
    
    const current = await this.cache.get<number>(key) || 0;
    
    if (current >= 100) { // 100 requests per minute
      throw new ThrottlerException();
    }
    
    await this.cache.set(key, current + 1, 60);
    return true;
  }
}
```

### Pagination

Always paginate large datasets:
```typescript
@Get()
async findAll(
  @Query('page') page = 1,
  @Query('limit') limit = 20,
) {
  const [items, total] = await this.repository.findAndCount({
    skip: (page - 1) * limit,
    take: Math.min(limit, 100), // Max 100 per page
  });
  
  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

### Async Processing

Offload heavy tasks to queues:
```typescript
// Use BullMQ for background jobs
@Injectable()
export class PetService {
  constructor(
    @InjectQueue('pets') private petsQueue: Queue,
  ) {}

  async processImage(petId: string, imageUrl: string) {
    await this.petsQueue.add('process-image', {
      petId,
      imageUrl,
    });
    
    return { status: 'processing' };
  }
}
```

## Infrastructure Scaling

### Horizontal Scaling

#### Docker Compose (Development)
```yaml
services:
  backend:
    image: petchain-backend
    deploy:
      replicas: 3
    environment:
      - NODE_ENV=production
```

#### Kubernetes (Production)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: petchain-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

### Load Balancing

Use nginx or cloud load balancers:
```nginx
upstream backend {
  least_conn;
  server backend1:3000;
  server backend2:3000;
  server backend3:3000;
}

server {
  listen 80;
  
  location / {
    proxy_pass http://backend;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

### Auto-Scaling

Configure based on metrics:
- CPU > 70%: Scale up
- Memory > 80%: Scale up
- Request rate > 1000/s: Scale up
- CPU < 30% for 10min: Scale down

## Monitoring & Alerting

### Metrics to Monitor

1. **Response Times**
   - P50, P95, P99 latencies
   - Per-endpoint breakdown

2. **Error Rates**
   - 4xx errors (client errors)
   - 5xx errors (server errors)
   - Timeout rates

3. **Resource Usage**
   - CPU utilization
   - Memory usage
   - Database connections
   - Redis memory

4. **Business Metrics**
   - Requests per second
   - Active users
   - Database query time
   - Cache hit rate

### Alerting Rules

```yaml
alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    duration: 5m
    severity: critical
    
  - name: SlowResponseTime
    condition: p95_latency > 1000ms
    duration: 5m
    severity: warning
    
  - name: HighMemoryUsage
    condition: memory_usage > 85%
    duration: 10m
    severity: warning
```

## Performance Checklist

- [ ] Database indexes on frequently queried columns
- [ ] Connection pooling configured
- [ ] Redis caching implemented
- [ ] Response compression enabled
- [ ] Rate limiting configured
- [ ] Pagination on list endpoints
- [ ] Background job processing for heavy tasks
- [ ] CDN for static assets
- [ ] Database query optimization
- [ ] Monitoring and alerting setup
- [ ] Load testing in CI/CD
- [ ] Auto-scaling configured

## Bottleneck Identification

### Common Bottlenecks

1. **Database Queries**
   - Enable query logging
   - Use EXPLAIN ANALYZE
   - Check for missing indexes

2. **External API Calls**
   - Add timeouts
   - Implement circuit breakers
   - Use async processing

3. **File Processing**
   - Offload to background jobs
   - Use streaming for large files
   - Implement chunked uploads

4. **Memory Leaks**
   - Monitor heap usage
   - Use heap snapshots
   - Check for event listener leaks

### Profiling Tools

```bash
# Node.js profiling
node --prof dist/main.js

# Memory profiling
node --inspect dist/main.js

# k6 profiling
k6 run --out json=results.json tests/load-test.js
```

## Quick Wins

1. **Enable Compression**: Reduces response size by 60-80%
2. **Add Redis Cache**: Reduces database load by 40-60%
3. **Database Indexes**: Improves query speed by 10-100x
4. **Connection Pooling**: Reduces connection overhead
5. **CDN for Assets**: Reduces server load and improves latency

## Next Steps

1. Run baseline load tests
2. Identify bottlenecks from results
3. Implement optimizations
4. Re-test and compare
5. Set up continuous monitoring
6. Configure alerting

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [NestJS Performance](https://docs.nestjs.com/techniques/performance)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [Redis Best Practices](https://redis.io/docs/management/optimization/)
