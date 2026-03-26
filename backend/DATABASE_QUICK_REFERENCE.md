# Database Performance - Quick Reference

## 🚀 Quick Start

### 1. Add Environment Variables
```bash
# Add to your .env file
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_SLOW_QUERY_THRESHOLD=1000
DB_LOGGING=false
```

### 2. Run Migration
```bash
cd backend
npm run typeorm migration:run
```

### 3. Verify
```bash
curl http://localhost:3000/api/v1/database/health
```

---

## 📊 Key Endpoints

```bash
# Health Check
GET /api/v1/database/health

# Performance Metrics
GET /api/v1/database/metrics

# Optimization Recommendations
GET /api/v1/database/analysis

# Slow Queries
GET /api/v1/database/slow-queries?limit=10

# Connection Pool Stats
GET /api/v1/database/connection-pool

# Table Sizes
GET /api/v1/database/table-sizes
```

---

## 🔧 Configuration

### Connection Pool
| Variable | Default | Description |
|----------|---------|-------------|
| `DB_POOL_MAX` | 20 | Maximum connections |
| `DB_POOL_MIN` | 2 | Minimum connections |
| `DB_POOL_IDLE_TIMEOUT` | 30000 | Idle timeout (ms) |
| `DB_POOL_CONNECTION_TIMEOUT` | 5000 | Connection wait timeout (ms) |

### Query Timeouts
| Variable | Default | Description |
|----------|---------|-------------|
| `DB_STATEMENT_TIMEOUT` | 60000 | Query execution timeout (ms) |
| `DB_QUERY_TIMEOUT` | 30000 | Query cancellation timeout (ms) |
| `DB_SLOW_QUERY_THRESHOLD` | 1000 | Slow query threshold (ms) |

---

## 📈 Key Metrics

### Healthy Values
- **Cache Hit Ratio:** > 90%
- **Index Usage Ratio:** > 80%
- **Active Connections:** < 80% of pool max
- **Waiting Clients:** 0
- **Average Query Time:** < 100ms
- **Slow Queries:** < 10/minute

### Warning Signs
- **Cache Hit Ratio:** < 75%
- **Index Usage Ratio:** < 60%
- **Active Connections:** > 90% of pool max
- **Waiting Clients:** > 0
- **Average Query Time:** > 500ms
- **Slow Queries:** > 50/minute

---

## 🐛 Troubleshooting

### High Connection Usage
```bash
# Check connection pool
GET /api/v1/database/connection-pool

# Solution: Increase DB_POOL_MAX or optimize queries
```

### Slow Queries
```bash
# Get slow queries
GET /api/v1/database/slow-queries?limit=20

# Analyze a query
POST /api/v1/database/query/analyze?query=SELECT * FROM pets WHERE owner_id = 'uuid'

# Solution: Add indexes or optimize query
```

### Low Cache Hit Ratio
```bash
# Check metrics
GET /api/v1/database/metrics

# Solution: Increase PostgreSQL shared_buffers or add Redis caching
```

### Poor Index Usage
```bash
# Get analysis
GET /api/v1/database/analysis

# Solution: Review missing indexes on frequently filtered columns
```

---

## 📝 New Indexes

### Most Important
- `users(email)` - User lookup
- `pets(owner_id)` - Pet ownership
- `pets(owner_id, deleted_at)` - Active pets
- `medical_records(petId)` - Pet medical history
- `medical_records(petId, visit_date)` - Timeline queries
- `vaccinations(pet_id)` - Pet vaccinations
- `vaccinations(pet_id, next_due_date)` - Reminders
- `notifications(userId, read)` - Unread notifications

---

## 🔍 Useful SQL Queries

### Check Index Usage
```sql
SELECT 
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as rows_read
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC
LIMIT 20;
```

### Find Largest Tables
```sql
SELECT 
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
```

### Check Active Connections
```sql
SELECT 
  state,
  count(*) as connections,
  max(now() - query_start) as longest_query
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;
```

---

## 📚 Documentation

- **Full Guide:** `DATABASE_PERFORMANCE.md`
- **Implementation Summary:** `DATABASE_OPTIMIZATION_SUMMARY.md`
- **Migration File:** `src/database/migrations/1742900001000-database-performance-optimization.ts`

---

## 🎯 Optimized Services

The following services have been optimized to fix N+1 queries:

- ✅ `PetsService` - All methods use QueryBuilder
- ✅ `MedicalRecordsService` - Optimized findAll/findOne/findByIds
- ✅ `VaccinationsService` - All query methods optimized
- ✅ `UsersService` - Core lookup methods optimized

---

**Last Updated:** March 26, 2024
**Version:** 1.0.0
