-- Database Performance Optimization Script
-- Run this to optimize PetChain database performance

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Pets table indexes
CREATE INDEX IF NOT EXISTS idx_pets_owner_id ON pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_pets_species ON pets(species);
CREATE INDEX IF NOT EXISTS idx_pets_microchip ON pets(microchip_number);
CREATE INDEX IF NOT EXISTS idx_pets_created_at ON pets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pets_name ON pets(name);

-- Vaccinations indexes
CREATE INDEX IF NOT EXISTS idx_vaccinations_pet_id ON vaccinations(pet_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_date ON vaccinations(vaccination_date DESC);
CREATE INDEX IF NOT EXISTS idx_vaccinations_next_due ON vaccinations(next_due_date);

-- Medical records indexes
CREATE INDEX IF NOT EXISTS idx_medical_records_pet_id ON medical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_date ON medical_records(record_date DESC);
CREATE INDEX IF NOT EXISTS idx_medical_records_type ON medical_records(record_type);

-- Appointments indexes
CREATE INDEX IF NOT EXISTS idx_appointments_pet_id ON appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Lost pets indexes
CREATE INDEX IF NOT EXISTS idx_lost_pets_status ON lost_pets(status);
CREATE INDEX IF NOT EXISTS idx_lost_pets_location ON lost_pets USING gist(location);
CREATE INDEX IF NOT EXISTS idx_lost_pets_created_at ON lost_pets(created_at DESC);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- FULL-TEXT SEARCH INDEXES
-- ============================================

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for text search
CREATE INDEX IF NOT EXISTS idx_pets_name_trgm ON pets USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_breeds_name_trgm ON breeds USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin(
  (first_name || ' ' || last_name) gin_trgm_ops
);

-- ============================================
-- COMPOSITE INDEXES
-- ============================================

-- Common query patterns
CREATE INDEX IF NOT EXISTS idx_pets_owner_species ON pets(owner_id, species);
CREATE INDEX IF NOT EXISTS idx_vaccinations_pet_date ON vaccinations(pet_id, vaccination_date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON appointments(clinic_id, appointment_date);

-- ============================================
-- PARTIAL INDEXES
-- ============================================

-- Active records only
CREATE INDEX IF NOT EXISTS idx_pets_active ON pets(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_upcoming ON appointments(appointment_date) 
  WHERE status = 'scheduled' AND appointment_date > NOW();

-- ============================================
-- VACUUM AND ANALYZE
-- ============================================

-- Update statistics for query planner
ANALYZE users;
ANALYZE pets;
ANALYZE vaccinations;
ANALYZE medical_records;
ANALYZE appointments;
ANALYZE lost_pets;

-- Reclaim space and update statistics
VACUUM ANALYZE;

-- ============================================
-- MATERIALIZED VIEWS FOR REPORTING
-- ============================================

-- Pet statistics view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_pet_statistics AS
SELECT 
  species,
  COUNT(*) as total_count,
  COUNT(DISTINCT owner_id) as unique_owners,
  AVG(EXTRACT(YEAR FROM AGE(date_of_birth))) as avg_age
FROM pets
WHERE deleted_at IS NULL
GROUP BY species;

CREATE INDEX IF NOT EXISTS idx_mv_pet_stats_species ON mv_pet_statistics(species);

-- Vaccination coverage view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vaccination_coverage AS
SELECT 
  p.species,
  v.vaccine_name,
  COUNT(*) as vaccination_count,
  COUNT(DISTINCT p.id) as pets_vaccinated
FROM vaccinations v
JOIN pets p ON v.pet_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.species, v.vaccine_name;

-- Refresh materialized views (run periodically)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pet_statistics;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vaccination_coverage;

-- ============================================
-- QUERY OPTIMIZATION SETTINGS
-- ============================================

-- Adjust PostgreSQL settings for better performance
-- Add to postgresql.conf:
-- shared_buffers = 256MB
-- effective_cache_size = 1GB
-- maintenance_work_mem = 64MB
-- checkpoint_completion_target = 0.9
-- wal_buffers = 16MB
-- default_statistics_target = 100
-- random_page_cost = 1.1
-- effective_io_concurrency = 200
-- work_mem = 4MB
-- min_wal_size = 1GB
-- max_wal_size = 4GB
