# PetChain Disaster Recovery System

This directory contains a comprehensive disaster recovery system for the PetChain application, providing automated backups, failover mechanisms, and recovery procedures.

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.sample .env

# Edit environment variables
nano .env
```

Required environment variables:
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=petchain_db
DB_USER=postgres
DB_PASSWORD=your_password

# Backup Configuration
BACKUP_DIR=/backups
S3_BUCKET=your-backup-bucket
NOTIFICATION_EMAIL=admin@petchain.com
SLACK_WEBHOOK=your-slack-webhook-url

# High Availability
AUTO_FAILOVER_ENABLED=true
FAILOVER_CHECK_INTERVAL=60
```

### 2. Start High Availability System

```bash
# Deploy with high availability
docker-compose -f docker-compose.ha.yml up -d

# Verify services are running
docker-compose -f docker-compose.ha.yml ps
```

### 3. Run Backup System

```bash
# Run complete backup
./scripts/backup-coordinator.sh

# Schedule daily backups (add to crontab)
0 2 * * * /path/to/scripts/backup-coordinator.sh
```

### 4. Test Recovery Procedures

```bash
# Run recovery testing (dry run)
./scripts/recovery-testing.sh --mode=full --dry-run=true

# Test actual recovery (in test environment)
./scripts/recovery-testing.sh --mode=database
```

## System Components

### 🔄 Backup Automation
- **Database Backups**: Automated PostgreSQL backups with compression
- **File Backups**: User uploads and documents backup
- **Configuration Backups**: System configurations and secrets
- **Cloud Storage**: Automatic S3 upload with retention policies

### ⚡ Failover Mechanisms
- **Database Failover**: Primary/standby PostgreSQL with automatic promotion
- **Application Failover**: Load-balanced backend instances
- **Cache Failover**: Redis master/slave with sentinel
- **Load Balancer**: NGINX with health checks and automatic routing

### 🛡️ Recovery Procedures
- **Automated Recovery**: One-command disaster recovery
- **Selective Recovery**: Database, files, or configuration only
- **Validation**: Post-recovery integrity checks
- **Rollback**: Ability to rollback failed recoveries

### 📊 Monitoring & Alerting
- **Health Monitoring**: Continuous service health checks
- **Backup Monitoring**: Backup age and integrity monitoring
- **Performance Monitoring**: System resource monitoring
- **Multi-channel Alerts**: Email, Slack, and Teams notifications

## Key Scripts

### Backup Scripts
```bash
# Complete backup coordination
./scripts/backup-coordinator.sh

# Database backup only
./scripts/backup-database.sh

# Files backup only
./scripts/backup-files.sh

# Configuration backup only
./scripts/backup-config.sh
```

### Recovery Scripts
```bash
# Full disaster recovery
./scripts/disaster-recovery.sh --mode=full

# Database recovery only
./scripts/disaster-recovery.sh --mode=database

# Files recovery only
./scripts/disaster-recovery.sh --mode=files

# Configuration recovery only
./scripts/disaster-recovery.sh --mode=config
```

### Testing Scripts
```bash
# Full recovery testing
./scripts/recovery-testing.sh --mode=full

# Database recovery testing
./scripts/recovery-testing.sh --mode=database

# Failover testing
./scripts/recovery-testing.sh --mode=failover
```

### Monitoring Scripts
```bash
# Start health monitoring
./scripts/health-monitor.sh

# Check system health (one-time)
./scripts/health-monitor.sh --check-once
```

## High Availability Architecture

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

## Backup Strategy

### Backup Schedule
- **Database**: Daily at 2:00 AM
- **Files**: Daily at 3:00 AM
- **Configuration**: Weekly on Sunday at 4:00 AM
- **System Snapshot**: Monthly on 1st at 1:00 AM

### Retention Policy
- **Daily Backups**: 30 days
- **Weekly Backups**: 12 weeks
- **Monthly Backups**: 12 months
- **Annual Backups**: 7 years

### Storage Locations
- **Local**: `/backups/` directory
- **Cloud**: AWS S3 with cross-region replication
- **Off-site**: Additional backup in separate geographic region

## Recovery Time Objectives

| Component | RTO | RPO | Description |
|-----------|-----|-----|-------------|
| Database | 15 minutes | 1 hour | Point-in-time recovery available |
| Application Files | 30 minutes | 24 hours | Daily backups with file manifests |
| Configuration | 10 minutes | 1 week | Weekly configuration backups |
| Complete System | 1 hour | 24 hours | Full disaster recovery procedures |

## Monitoring Dashboard

### Health Checks
- **Service Status**: Real-time service health monitoring
- **Resource Usage**: CPU, memory, disk usage tracking
- **Backup Status**: Backup age and integrity monitoring
- **Replication Status**: Database and Redis replication monitoring

### Alerts
- **Critical**: Service failures, backup failures, high resource usage
- **Warning**: Performance degradation, backup age warnings
- **Info**: Routine status updates, maintenance notifications

## Testing Procedures

### Monthly Testing
1. **Backup Integrity**: Verify all backups are valid and accessible
2. **Recovery Testing**: Test database and file recovery procedures
3. **Failover Testing**: Test automatic failover mechanisms
4. **Performance Testing**: Validate system performance under load

### Quarterly Testing
1. **Full Disaster Recovery**: Complete system recovery in test environment
2. **Documentation Review**: Update runbooks and procedures
3. **Security Assessment**: Verify backup encryption and access controls
4. **Capacity Planning**: Review storage and resource requirements

## Security Features

### Backup Security
- **Encryption**: AES-256 encryption for all backups
- **Access Control**: Role-based access control for backup operations
- **Audit Logging**: Complete audit trail of all backup/recovery actions
- **Compliance**: GDPR/CCPA compliant data handling

### Network Security
- **Firewall Rules**: Restrictive firewall configurations
- **SSL/TLS**: Modern encryption protocols only
- **VPN Access**: Secure remote access for administration
- **Multi-factor Authentication**: Required for critical operations

## Troubleshooting

### Common Issues

#### Backup Failures
```bash
# Check backup logs
tail -f /var/log/petchain/backup_*.log

# Verify disk space
df -h /backups

# Check database connectivity
pg_isready -h localhost -p 5432
```

#### Recovery Failures
```bash
# Check recovery logs
tail -f /var/log/petchain/disaster_recovery_*.log

# Verify backup integrity
gzip -t /backups/database/latest_backup.sql.gz

# Test database connection
psql -h localhost -U postgres -d petchain_db
```

#### Failover Issues
```bash
# Check failover manager logs
tail -f /var/log/petchain/failover_manager_*.log

# Verify service health
curl http://localhost:3000/health
curl http://localhost:3001/health

# Check load balancer status
curl http://localhost/upstream_status
```

## Maintenance

### Daily Tasks
- Monitor backup completion
- Review system health dashboard
- Check alert notifications

### Weekly Tasks
- Verify backup integrity
- Review system performance metrics
- Update documentation as needed

### Monthly Tasks
- Run full recovery testing
- Review and update retention policies
- Perform security assessments

## Support

### Emergency Contacts
- **DevOps Lead**: devops@petchain.com (24/7)
- **Database Admin**: dba@petchain.com (24/7)
- **Security Lead**: security@petchain.com (Business hours)

### Documentation
- **Runbook**: `docs/disaster-recovery-runbook.md`
- **Technical Documentation**: `docs/disaster-recovery-documentation.md`
- **API Documentation**: `docs/api/`

### Monitoring
- **Health Dashboard**: Available at `/health` endpoint
- **System Metrics**: Available at `/metrics` endpoint
- **Backup Status**: Available at `/backup-status` endpoint

## Contributing

When making changes to the disaster recovery system:

1. **Test Changes**: Always test in a non-production environment
2. **Update Documentation**: Keep all documentation current
3. **Review Security**: Ensure security implications are considered
4. **Backup Testing**: Verify backup/recovery procedures after changes

## License

This disaster recovery system is part of the PetChain application and follows the same licensing terms.

---

**Last Updated**: March 25, 2024  
**Version**: 1.0  
**Maintained By**: PetChain DevOps Team
