# PetChain Disaster Recovery Documentation

## Overview

This document provides comprehensive documentation for the PetChain disaster recovery system, including automated backups, failover mechanisms, recovery procedures, and monitoring systems.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Backup Systems](#backup-systems)
3. [Failover Mechanisms](#failover-mechanisms)
4. [Recovery Procedures](#recovery-procedures)
5. [Monitoring and Alerting](#monitoring-and-alerting)
6. [Testing and Validation](#testing-and-validation)
7. [Maintenance and Operations](#maintenance-and-operations)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Appendices](#appendices)

## System Architecture

### High Availability Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Health Monitor │
│   (NGINX)       │    │   (Continuous)   │
└─────────┬───────┘    └─────────────────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐
│ Backend Primary │◄──►│ Backend Secondary│
│ (Port 3000)     │    │ (Port 3001)     │
└─────────┬───────┘    └─────────────────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐
│ PostgreSQL      │◄──►│ PostgreSQL      │
│ Primary         │    │ Standby         │
│ (Port 5432)     │    │ (Port 5433)     │
└─────────┬───────┘    └─────────────────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐
│ Redis Master    │◄──►│ Redis Slave     │
│ (Port 6379)     │    │ (Port 6380)     │
└─────────────────┘    └─────────────────┘
```

### Component Responsibilities

| Component | Primary Role | Backup Role | Monitoring |
|-----------|--------------|-------------|------------|
| Load Balancer | Distribute traffic | Failover routing | Health checks |
| Backend Primary | Serve requests | Standby ready | Health endpoints |
| Backend Secondary | Serve requests | Take over when primary fails | Health endpoints |
| PostgreSQL Primary | Database operations | Master for replication | Replication status |
| PostgreSQL Standby | Ready for failover | Replica of primary | Replication lag |
| Redis Master | Cache operations | Master for replication | Replication status |
| Redis Slave | Ready for failover | Replica of master | Replication status |

## Backup Systems

### Backup Types and Schedules

| Backup Type | Frequency | Retention | Storage Location | Size Estimate |
|-------------|-----------|-----------|------------------|---------------|
| Database | Daily (2 AM) | 30 days | Local + S3 | 500MB - 2GB |
| Files | Daily (3 AM) | 30 days | Local + S3 | 1GB - 10GB |
| Configuration | Weekly (Sunday 4 AM) | 12 weeks | Local + S3 | 50MB - 200MB |
| System Snapshot | Monthly (1st of month) | 12 months | Local + S3 | 5GB - 20GB |

### Backup Scripts

#### 1. Database Backup (`backup-database.sh`)
- **Purpose**: Complete PostgreSQL database backups
- **Features**: 
  - Compressed backups with integrity verification
  - Point-in-time recovery capability
  - Automatic cleanup of old backups
  - S3 upload with metadata tagging

#### 2. Files Backup (`backup-files.sh`)
- **Purpose**: Backup user uploads and documents
- **Features**:
  - Excludes temporary and cache files
  - Creates file manifest for verification
  - Preserves file permissions and structure

#### 3. Configuration Backup (`backup-config.sh`)
- **Purpose**: Backup all configuration files and secrets
- **Features**:
  - Docker configurations
  - Environment files
  - SSL certificates
  - Vault secrets (if configured)

#### 4. Backup Coordinator (`backup-coordinator.sh`)
- **Purpose**: Orchestrates all backup operations
- **Features**:
  - Pre-backup system health checks
  - Retry mechanisms for failed backups
  - Post-backup validation
  - Comprehensive reporting and notifications

### Backup Storage Strategy

#### Local Storage
- **Location**: `/backups/`
- **Structure**:
  ```
  /backups/
  ├── database/
  │   ├── petchain_db_backup_20240325_020000.sql.gz
  │   └── backup_metadata_20240325_020000.json
  ├── files/
  │   ├── files_backup_20240325_030000.tar.gz
  │   └── file_manifest_20240325_030000.txt
  └── config/
      ├── config_backup_20240325_040000.tar.gz
      └── config_backup_metadata_20240325_040000.json
  ```

#### Cloud Storage (AWS S3)
- **Bucket Structure**:
  ```
  s3://petchain-backups/
  ├── database-backups/
  ├── file-backups/
  ├── config-backups/
  └── system-snapshots/
  ```
- **Features**:
  - Cross-region replication
  - Versioning enabled
  - Lifecycle policies for automatic cleanup
  - Server-side encryption

## Failover Mechanisms

### Automatic Failover System

#### Failover Manager (`failover-manager.sh`)
- **Purpose**: Automated detection and recovery from service failures
- **Features**:
  - Continuous health monitoring
  - Configurable failure thresholds
  - Automatic service promotion
  - Notification system

#### Health Check Endpoints

| Service | Endpoint | Check Frequency | Timeout |
|---------|----------|-----------------|---------|
| Database | `pg_isready` | Every 60s | 10s |
| Backend Primary | `http://localhost:3000/health` | Every 60s | 10s |
| Backend Secondary | `http://localhost:3001/health` | Every 60s | 10s |
| Redis Master | `redis-cli ping` | Every 60s | 10s |
| Redis Slave | `redis-cli ping` | Every 60s | 10s |

#### Failover Triggers

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Service health check failure | 3 consecutive failures | Initiate failover |
| Database replication lag | > 5 minutes | Send warning |
| Disk usage | > 90% | Send critical alert |
| Memory usage | > 95% | Restart services |

### Load Balancer Configuration

#### NGINX High Availability Setup
- **Algorithm**: Least connections
- **Health Checks**: Active/passive checks every 5 seconds
- **Session Persistence**: IP hash for WebSocket connections
- **Rate Limiting**: 10 requests/second per IP

#### Upstream Configuration
```nginx
upstream backend {
    least_conn;
    server backend-primary:3000 max_fails=3 fail_timeout=30s;
    server backend-secondary:3000 max_fails=3 fail_timeout=30s;
    check interval=5000 rise=2 fall=3 timeout=3000 type=http;
}
```

## Recovery Procedures

### Disaster Recovery Script (`disaster-recovery.sh`)

#### Recovery Modes
1. **Full Recovery**: Complete system restoration
2. **Database Recovery**: Database only restoration
3. **Files Recovery**: File storage only restoration
4. **Configuration Recovery**: Configuration only restoration

#### Recovery Process Flow
1. **Pre-recovery Checks**
   - System health validation
   - Disk space verification
   - Network connectivity tests

2. **Backup Selection**
   - Identify latest valid backup
   - Verify backup integrity
   - Confirm backup metadata

3. **Service Preparation**
   - Stop running services
   - Create recovery directories
   - Backup current state

4. **Data Restoration**
   - Extract backup files
   - Restore data to appropriate locations
   - Set correct permissions

5. **Service Restart**
   - Start database services
   - Start application services
   - Verify service health

6. **Post-recovery Validation**
   - Data integrity checks
   - Service health verification
   - Performance validation

### Manual Recovery Procedures

#### Database Corruption Recovery
1. **Stop application services**
2. **Identify corruption point**
3. **Select appropriate backup**
4. **Restore database**
5. **Verify data integrity**
6. **Restart services**

#### Complete System Recovery
1. **Provision new infrastructure**
2. **Install base software**
3. **Restore application code**
4. **Run automated recovery**
5. **Validate system functionality**

## Monitoring and Alerting

### Health Monitoring System (`health-monitor.sh`)

#### Monitoring Categories
1. **System Resources**
   - Disk usage
   - Memory usage
   - CPU load
   - Network connectivity

2. **Service Health**
   - Application endpoints
   - Database connectivity
   - Cache availability
   - Load balancer status

3. **Backup Status**
   - Backup age verification
   - Backup integrity checks
   - Storage capacity monitoring

4. **Replication Status**
   - Database replication lag
   - Redis replication health
   - Synchronization verification

#### Alert Levels

| Level | Condition | Notification Channels |
|-------|-----------|----------------------|
| INFO | Routine status updates | Email |
| WARNING | Degraded performance | Email + Slack |
| CRITICAL | Service failure | Email + Slack + Teams |

#### Notification Templates

##### Critical Service Failure
```
🚨 CRITICAL: Service Failure Detected

Service: Database Primary
Time: 2024-03-25 14:30:00
Status: Unresponsive
Action: Automatic failover initiated

Immediate action required!
```

##### Backup Age Warning
```
⚠️ WARNING: Backup Age Exceeded Limits

Backup Type: Database
Latest Backup: 2024-03-23 02:00:00
Age: 48 hours
Threshold: 24 hours

Please investigate backup system.
```

## Testing and Validation

### Recovery Testing Framework (`recovery-testing.sh`)

#### Test Types
1. **Backup Integrity Tests**
   - File corruption detection
   - Size validation
   - Format verification

2. **Recovery Procedure Tests**
   - Database restoration
   - File recovery
   - Configuration recovery

3. **Failover Mechanism Tests**
   - Service failover
   - Load balancer behavior
   - Replication validation

4. **End-to-End Tests**
   - Complete disaster simulation
   - Recovery time measurement
   - Data integrity verification

#### Test Execution

```bash
# Full test suite
./scripts/recovery-testing.sh --mode=full

# Database only test
./scripts/recovery-testing.sh --mode=database

# Failover test
./scripts/recovery-testing.sh --mode=failover

# Dry run (no actual recovery)
./scripts/recovery-testing.sh --dry-run=true
```

#### Test Reports

Test results are generated in JSON format with:
- Test execution details
- Success/failure status
- Performance metrics
- System information
- Recommendations

## Maintenance and Operations

### Scheduled Tasks

#### Daily Tasks
- **2:00 AM**: Database backup
- **3:00 AM**: Files backup
- **4:00 AM**: Health check report
- **5:00 AM**: System cleanup

#### Weekly Tasks
- **Sunday 4:00 AM**: Configuration backup
- **Monday 9:00 AM**: Backup verification
- **Friday 5:00 PM**: Weekly health report

#### Monthly Tasks
- **1st of month**: System snapshot
- **First Monday**: Recovery testing
- **Last Friday**: Maintenance window

### Maintenance Procedures

#### Backup Verification
1. Check backup completion logs
2. Verify backup integrity
3. Test restoration procedures
4. Update backup documentation

#### System Updates
1. Schedule maintenance window
2. Create pre-update backup
3. Apply updates
4. Validate system functionality
5. Update documentation

#### Performance Tuning
1. Monitor system metrics
2. Identify bottlenecks
3. Implement optimizations
4. Measure improvements

## Security Considerations

### Backup Security

#### Encryption
- **At Rest**: AES-256 encryption
- **In Transit**: TLS 1.2+ encryption
- **Key Management**: AWS KMS or HashiCorp Vault

#### Access Control
- **Backup Access**: Role-based access control
- **Recovery Access**: Multi-factor authentication required
- **Audit Logging**: All backup/recovery actions logged

#### Compliance
- **Data Retention**: Configurable retention policies
- **Data Privacy**: PII handling procedures
- **Regulatory**: GDPR/CCPA compliance measures

### Network Security

#### Firewall Rules
```bash
# Database access (application servers only)
5432  ALLOW  10.0.0.0/8
5433  ALLOW  10.0.0.0/8

# Redis access (application servers only)
6379  ALLOW  10.0.0.0/8
6380  ALLOW  10.0.0.0/8

# Application access (load balancer only)
3000  ALLOW  172.20.0.10
3001  ALLOW  172.20.0.10
```

#### SSL/TLS Configuration
- **Protocols**: TLS 1.2 and 1.3 only
- **Ciphers**: Modern cipher suites only
- **Certificates**: Automated renewal and monitoring

## Troubleshooting Guide

### Common Issues and Solutions

#### Backup Failures

##### Issue: Database backup fails with "connection refused"
**Symptoms**: Backup logs show connection errors
**Causes**: Database service not running, network issues
**Solutions**:
1. Check database service status: `systemctl status postgresql`
2. Verify network connectivity: `telnet localhost 5432`
3. Check database logs: `/var/log/postgresql/postgresql-16-main.log`

##### Issue: File backup runs out of disk space
**Symptoms**: Backup fails with "no space left on device"
**Causes**: Insufficient disk space, large file accumulation
**Solutions**:
1. Check disk usage: `df -h`
2. Clean old backups: `find /backups -name "*.gz" -mtime +30 -delete`
3. Increase disk capacity or implement compression

#### Recovery Failures

##### Issue: Database restoration fails with "role does not exist"
**Symptoms**: psql restore command fails
**Causes**: Missing database user, permission issues
**Solutions**:
1. Create database user: `createuser -s postgres`
2. Check database exists: `psql -l`
3. Verify permissions: `\du`

##### Issue: Application won't start after recovery
**Symptoms**: Services fail to start, connection errors
**Causes**: Missing configuration files, incorrect environment
**Solutions**:
1. Check configuration files: `docker-compose config`
2. Verify environment variables: `docker-compose exec backend env`
3. Check service logs: `docker-compose logs backend`

#### Failover Issues

##### Issue: Automatic failover doesn't trigger
**Symptoms**: Primary service down but no failover occurs
**Causes**: Health check misconfiguration, network issues
**Solutions**:
1. Check failover manager logs: `/var/log/petchain/failover_manager_*.log`
2. Verify health check endpoints: `curl http://localhost:3000/health`
3. Check network connectivity between services

##### Issue: Load balancer sends traffic to failed service
**Symptoms**: Users experience errors despite failover
**Causes**: NGINX configuration issues, health check failures
**Solutions**:
1. Check NGINX configuration: `nginx -t`
2. Verify upstream status: `curl http://localhost/upstream_status`
3. Reload NGINX: `docker exec petchain_nginx_lb nginx -s reload`

### Performance Issues

#### Slow Backup Performance
**Symptoms**: Backups taking longer than expected
**Causes**: Large database size, network bottlenecks
**Solutions**:
1. Optimize database: `VACUUM ANALYZE;`
2. Check network bandwidth: `iftop`
3. Implement parallel backups

#### High Recovery Time
**Symptoms**: Recovery taking hours instead of minutes
**Causes**: Large backup files, slow storage, network issues
**Solutions**:
1. Use incremental backups
2. Optimize storage performance
3. Implement pre-staging of critical components

## Appendices

### Appendix A: Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `BACKUP_DIR` | Local backup directory | `/backups` | No |
| `S3_BUCKET` | S3 bucket for cloud backups | - | No |
| `NOTIFICATION_EMAIL` | Email for notifications | - | No |
| `SLACK_WEBHOOK` | Slack webhook URL | - | No |
| `DB_HOST` | Database host | `localhost` | Yes |
| `DB_PORT` | Database port | `5432` | Yes |
| `DB_NAME` | Database name | `petchain_db` | Yes |
| `DB_USER` | Database user | `postgres` | Yes |
| `DB_PASSWORD` | Database password | - | Yes |

### Appendix B: File Structure

```
backend/
├── scripts/
│   ├── backup-database.sh
│   ├── backup-files.sh
│   ├── backup-config.sh
│   ├── backup-coordinator.sh
│   ├── disaster-recovery.sh
│   ├── failover-manager.sh
│   ├── recovery-testing.sh
│   └── health-monitor.sh
├── nginx/
│   ├── nginx-ha.conf
│   └── ssl/
├── docs/
│   ├── disaster-recovery-runbook.md
│   └── disaster-recovery-documentation.md
├── docker-compose.ha.yml
└── docker-compose.yml
```

### Appendix C: Port Configuration

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| PostgreSQL Primary | 5432 | TCP | Main database |
| PostgreSQL Standby | 5433 | TCP | Replica database |
| Redis Master | 6379 | TCP | Main cache |
| Redis Slave | 6380 | TCP | Replica cache |
| Backend Primary | 3000 | HTTP | Main application |
| Backend Secondary | 3001 | HTTP | Backup application |
| NGINX Load Balancer | 80, 443 | HTTP/HTTPS | Load balancing |
| Redis Sentinel | 26379 | TCP | Redis failover |

### Appendix D: Recovery Time Objectives (RTO/RPO)

| Component | RTO | RPO | Notes |
|-----------|-----|-----|-------|
| Database | 15 minutes | 1 hour | Point-in-time recovery available |
| Application Files | 30 minutes | 24 hours | Daily backups |
| Configuration | 10 minutes | 1 week | Weekly backups |
| Complete System | 1 hour | 24 hours | Full disaster recovery |

### Appendix E: Contact Information

| Role | Contact | Hours |
|------|---------|-------|
| DevOps Lead | devops@petchain.com | 24/7 |
| Database Admin | dba@petchain.com | 24/7 |
| Security Lead | security@petchain.com | Business hours |
| Product Manager | pm@petchain.com | Business hours |

---

**Document Version**: 1.0  
**Last Updated**: March 25, 2024  
**Next Review**: March 25, 2024  
**Approved By**: DevOps Team

This documentation is part of the PetChain Disaster Recovery System and should be reviewed and updated regularly to ensure accuracy and completeness.
