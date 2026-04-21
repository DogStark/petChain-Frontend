# PetChain Disaster Recovery Runbook

## Overview

This runbook provides step-by-step procedures for recovering the PetChain application from various disaster scenarios. It covers automated recovery scripts, manual procedures, and validation checks.

## Table of Contents

1. [Emergency Contacts](#emergency-contacts)
2. [System Architecture](#system-architecture)
3. [Backup Strategy](#backup-strategy)
4. [Recovery Procedures](#recovery-procedures)
5. [Validation Steps](#validation-steps)
6. [Troubleshooting](#troubleshooting)
7. [Post-Recovery Tasks](#post-recovery-tasks)

## Emergency Contacts

| Role | Contact | Responsibility |
|------|---------|----------------|
| DevOps Lead | devops@petchain.com | Infrastructure & Recovery |
| Database Admin | dba@petchain.com | Database Recovery |
| Security Lead | security@petchain.com | Security Assessment |
| Product Manager | pm@petchain.com | Communication & Coordination |

## System Architecture

### Components
- **Frontend**: Next.js application
- **Backend**: NestJS API
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Storage**: AWS S3 / Google Cloud Storage
- **Container**: Docker with Docker Compose
- **Monitoring**: Custom monitoring solution

### Data Locations
- **Database**: `/var/lib/postgresql/data`
- **Application Files**: `/app/uploads`
- **Configurations**: `/app/config`
- **Logs**: `/var/log/petchain`
- **Backups**: `/backups`

## Backup Strategy

### Backup Types
1. **Database Backups**: Daily full backups with point-in-time recovery
2. **File Backups**: Daily incremental backups of user uploads
3. **Configuration Backups**: Weekly backups of all configuration files
4. **System Backups**: Monthly full system snapshots

### Backup Retention
- **Daily backups**: 30 days
- **Weekly backups**: 12 weeks
- **Monthly backups**: 12 months
- **Annual backups**: 7 years

### Backup Storage
- **Local Storage**: `/backups` directory
- **Cloud Storage**: AWS S3 with cross-region replication
- **Off-site**: Additional backup in separate geographic region

## Recovery Procedures

### Automated Recovery

#### Prerequisites
- SSH access to recovery server
- Sudo privileges
- Network connectivity to backup storage
- Valid environment variables

#### Quick Recovery Commands

```bash
# Full system recovery (latest backup)
export RECOVERY_MODE=full
./scripts/disaster-recovery.sh

# Database only recovery
export RECOVERY_MODE=database
export BACKUP_TIMESTAMP=20240325_120000
./scripts/disaster-recovery.sh

# Test recovery (dry run)
export DRY_RUN=true
./scripts/disaster-recovery.sh
```

### Manual Recovery Procedures

#### Scenario 1: Database Corruption

**Symptoms:**
- Database connection failures
- Data integrity errors
- Application crashes

**Recovery Steps:**

1. **Stop Application Services**
   ```bash
   docker-compose down
   sudo systemctl stop postgresql
   ```

2. **Identify Latest Valid Backup**
   ```bash
   find /backups/database -name "*.gz" -type f | sort -r | head -5
   ```

3. **Verify Backup Integrity**
   ```bash
   gzip -t /backups/database/petchain_db_backup_YYYYMMDD_HHMMSS.sql.gz
   ```

4. **Restore Database**
   ```bash
   # Drop corrupted database
   dropdb -h localhost -U postgres petchain_db
   
   # Create new database
   createdb -h localhost -U postgres petchain_db
   
   # Restore from backup
   gunzip -c /backups/database/petchain_db_backup_YYYYMMDD_HHMMSS.sql.gz | \
   psql -h localhost -U postgres petchain_db
   ```

5. **Verify Restoration**
   ```bash
   psql -h localhost -U postgres petchain_db -c "\dt"
   psql -h localhost -U postgres petchain_db -c "SELECT count(*) FROM users;"
   ```

6. **Restart Services**
   ```bash
   sudo systemctl start postgresql
   docker-compose up -d
   ```

#### Scenario 2: File System Corruption

**Symptoms:**
- Missing uploaded files
- File access errors
- Storage space issues

**Recovery Steps:**

1. **Stop File-dependent Services**
   ```bash
   docker-compose stop backend
   ```

2. **Backup Current State**
   ```bash
   mv ./uploads ./uploads.corrupted.$(date +%Y%m%d_%H%M%S)
   ```

3. **Restore Files from Backup**
   ```bash
   # Extract backup
   tar -xzf /backups/files/files_backup_YYYYMMDD_HHMMSS.tar.gz -C /tmp/
   
   # Move to original location
   mv /tmp/uploads ./uploads
   
   # Set permissions
   chmod -R 755 ./uploads
   chown -R app:app ./uploads
   ```

4. **Verify File Integrity**
   ```bash
   find ./uploads -type f | wc -l
   ls -la ./uploads/
   ```

5. **Restart Services**
   ```bash
   docker-compose up -d
   ```

#### Scenario 3: Configuration Loss

**Symptoms:**
- Application startup failures
- Environment variable errors
- Service configuration issues

**Recovery Steps:**

1. **Identify Configuration Backup**
   ```bash
   find /backups/config -name "*.tar.gz" -type f | sort -r | head -1
   ```

2. **Extract Configuration**
   ```bash
   tar -xzf /backups/config/config_backup_YYYYMMDD_HHMMSS.tar.gz -C /tmp/
   ```

3. **Restore Critical Files**
   ```bash
   # Environment files
   cp /tmp/.env.production ./
   cp /tmp/docker-compose.yml ./
   
   # SSL certificates
   cp -r /tmp/ssl ./
   
   # Application config
   cp /tmp/nest-cli.json ./
   ```

4. **Verify Configuration**
   ```bash
   docker-compose config
   ```

5. **Restart Services**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

#### Scenario 4: Complete System Failure

**Symptoms:**
- Server unavailable
- Multiple component failures
- Network connectivity issues

**Recovery Steps:**

1. **Provision New Infrastructure**
   - Set up new server with same specifications
   - Install required dependencies
   - Configure network and security

2. **Install Base Software**
   ```bash
   # Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Docker Compose
   curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   chmod +x /usr/local/bin/docker-compose
   
   # PostgreSQL client
   apt-get update
   apt-get install -y postgresql-client
   ```

3. **Restore Application Code**
   ```bash
   git clone <repository-url> .
   git checkout <production-branch>
   ```

4. **Run Full Recovery**
   ```bash
   export RECOVERY_MODE=full
   export BACKUP_TIMESTAMP=<desired-backup-timestamp>
   ./scripts/disaster-recovery.sh
   ```

## Validation Steps

### Database Validation
```bash
# Check database connectivity
pg_isready -h localhost -p 5432

# Verify table count
psql -h localhost -U postgres petchain_db -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Check critical tables
psql -h localhost -U postgres petchain_db -c "SELECT count(*) FROM users;"
psql -h localhost -U postgres petchain_db -c "SELECT count(*) FROM pets;"
```

### Application Validation
```bash
# Check container status
docker-compose ps

# Check application logs
docker-compose logs backend | tail -50

# Health check endpoint
curl -f http://localhost:3000/health || echo "Health check failed"
```

### File Validation
```bash
# Check upload directory
ls -la ./uploads/
find ./uploads -type f | wc -l

# Verify file permissions
stat ./uploads/
```

### Network Validation
```bash
# Check service connectivity
netstat -tlnp | grep :3000
netstat -tlnp | grep :5432

# Test external dependencies
ping -c 1 google.com
nslookup aws.amazon.com
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
**Possible Causes:**
- PostgreSQL service not running
- Incorrect connection parameters
- Network connectivity issues

**Solutions:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Restart service
sudo systemctl restart postgresql
```

#### Container Startup Issues
**Possible Causes:**
- Missing environment variables
- Port conflicts
- Volume mount issues

**Solutions:**
```bash
# Check container logs
docker-compose logs backend

# Verify configuration
docker-compose config

# Recreate containers
docker-compose down
docker-compose up -d --force-recreate
```

#### File Permission Issues
**Possible Causes:**
- Incorrect ownership
- Missing directories
- SELinux restrictions

**Solutions:**
```bash
# Fix ownership
sudo chown -R app:app ./uploads

# Create missing directories
mkdir -p ./uploads/{avatars,documents,medical}

# Check SELinux
sestatus
```

### Performance Issues

#### Slow Database Performance
```bash
# Check active connections
psql -h localhost -U postgres petchain_db -c "SELECT count(*) FROM pg_stat_activity;"

# Analyze slow queries
psql -h localhost -U postgres petchain_db -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Rebuild indexes
psql -h localhost -U postgres petchain_db -c "REINDEX DATABASE petchain_db;"
```

#### High Memory Usage
```bash
# Check memory usage
free -h
docker stats

# Restart services if needed
docker-compose restart
```

## Post-Recovery Tasks

### Immediate Tasks (0-2 hours)
1. **Verify all services are running**
2. **Run health checks**
3. **Monitor system performance**
4. **Notify stakeholders**

### Short-term Tasks (2-24 hours)
1. **Run full application tests**
2. **Verify data integrity**
3. **Check backup systems**
4. **Update monitoring alerts**

### Long-term Tasks (1-7 days)
1. **Conduct post-mortem analysis**
2. **Update recovery procedures**
3. **Implement preventive measures**
4. **Schedule additional testing**

### Communication Templates

#### Initial Incident Notification
```
Subject: URGENT - PetChain Service Disruption

Dear Team,

We are currently experiencing a service disruption affecting PetChain.

Status: INVESTIGATING
Impact: Users unable to access the application
Next Update: 30 minutes

We are working to resolve the issue and will provide updates as available.

Thank you for your patience.
```

#### Recovery Completion Notification
```
Subject: RESOLVED - PetChain Service Recovery

Dear Team,

The PetChain service disruption has been resolved.

Status: RESOLVED
Recovery Time: X hours Y minutes
Impact: Service fully restored

All systems are now operational. We will conduct a post-incident review to prevent future occurrences.

Thank you for your patience and support.
```

## Testing and Maintenance

### Monthly Recovery Drills
- Test automated recovery scripts
- Validate backup integrity
- Update contact information
- Review and update procedures

### Quarterly Full-Scale Tests
- Complete system recovery in test environment
- Performance validation
- Security assessment
- Documentation updates

### Annual Review
- Complete runbook revision
- Architecture assessment
- Disaster recovery plan update
- Training and awareness programs

## Additional Resources

### Monitoring Tools
- Application monitoring: Custom dashboard
- Database monitoring: pgAdmin + custom scripts
- Infrastructure monitoring: System logs
- Network monitoring: ping tests + connectivity checks

### Documentation
- API documentation: `/docs/api`
- Database schema: `/docs/database`
- Deployment guide: `/docs/deployment`
- Security procedures: `/docs/security`

### Support Channels
- Internal chat: #disaster-recovery
- Email: emergency@petchain.com
- Phone: +1-555-EMERGENCY

---

**Last Updated:** March 25, 2024  
**Version:** 1.0  
**Next Review:** March 25, 2024
