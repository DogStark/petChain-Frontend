# Intrusion Detection and Prevention System (IDS/IPS)

This document describes the comprehensive IDS/IPS implementation for the PetChain application.

## Overview

The IDS/IPS system provides real-time threat detection, automated response mechanisms, and security monitoring to protect against various cyber threats including SQL injection, XSS attacks, brute force attempts, DDoS attacks, and unauthorized access.

## Features

### ✅ Real-time Threat Detection
- **SQL Injection Detection**: Pattern-based detection of SQL injection attempts
- **XSS Protection**: Cross-site scripting attack detection
- **Path Traversal Prevention**: Directory traversal attack blocking
- **Brute Force Detection**: Login attempt pattern analysis
- **Unauthorized Access Monitoring**: Suspicious access pattern detection
- **DDoS Protection**: Request flood detection and mitigation

### ✅ Automated Blocking Mechanisms
- **IP Blacklisting**: Automatic IP blocking based on threat scores
- **Rate Limiting**: Request throttling for suspicious IPs
- **Dynamic Blocking**: Temporary and permanent IP blocks
- **Request Filtering**: Middleware-based request inspection

### ✅ Security Event Logging
- **Comprehensive Logging**: All security events stored in database
- **Event Classification**: Categorized by type and severity
- **Metadata Storage**: Detailed event information and context
- **Audit Trail**: Complete security event history

### ✅ Alert System
- **Real-time Alerts**: Immediate notification of security threats
- **Severity-based Routing**: Different handling for different threat levels
- **Admin Notifications**: Push notifications to administrators
- **Alert Escalation**: Automatic escalation for critical threats

### ✅ Incident Response Automation
- **Automated Responses**: Pre-configured response actions
- **Threat Score Calculation**: Risk assessment for automated decisions
- **Cooldown Management**: Prevents alert fatigue
- **Pattern Analysis**: Threat pattern detection and analysis

## Architecture

### Core Services

#### ThreatDetectionService
- Analyzes incoming requests for security threats
- Calculates threat scores and determines blocking actions
- Logs security events to database

#### AlertService
- Manages security alert rules and notifications
- Sends real-time alerts to administrators
- Handles alert escalation and routing

#### IncidentResponseService
- Executes automated response actions
- Manages response rules and cooldowns
- Analyzes threat patterns over time

#### SecurityMonitoringService
- Provides real-time security metrics
- Tracks active alerts and system health
- Generates threat intelligence reports

#### IpBlacklistService
- Manages IP blacklisting operations
- Handles temporary and permanent blocks
- Automatic cleanup of expired entries

### Middleware & Guards

#### SqlInjectionDetectionMiddleware
- Inspects requests for SQL injection patterns
- Blocks malicious requests automatically

#### XssProtectionMiddleware
- Detects and prevents XSS attacks
- Sanitizes potentially dangerous content

#### SecurityHeadersMiddleware
- Adds security headers to responses
- Implements CSP and other protections

#### RateLimitGuard
- Enforces request rate limits
- Tracks and blocks abusive IPs

#### IpBlacklistGuard
- Checks requests against blacklist
- Blocks known malicious IPs

#### DdosProtectionGuard
- Monitors for DDoS attack patterns
- Implements request throttling

## API Endpoints

### Security Monitoring
```
GET /security/metrics?timeRange=24h
GET /security/alerts
POST /security/alerts/:alertId/acknowledge
GET /security/events
GET /security/threat-intelligence
```

### IP Blacklist Management
```
POST /security/blacklist/:ipAddress
POST /security/blacklist/:ipAddress/remove
GET /security/blacklist
```

### Configuration
```
GET /security/response-rules
GET /security/alert-rules
POST /security/test-threat-detection
```

## Configuration

### Threat Score Thresholds
```typescript
THREAT_SCORES: {
  SQL_INJECTION: 100,
  XSS_ATTEMPT: 80,
  BRUTE_FORCE: 70,
  UNAUTHORIZED_ACCESS: 60,
  SUSPICIOUS_ACTIVITY: 40,
  RATE_LIMIT_EXCEEDED: 50,
  SUSPICIOUS_PATTERN: 30,
  BLACKLIST_THRESHOLD: 100,
}
```

### Alert Rules
- **CRITICAL**: SQL Injection, DDoS attacks
- **HIGH**: XSS attempts, Brute force
- **MEDIUM**: Unauthorized access
- **LOW**: Rate limit violations

### Response Actions
- **Block IP**: Automatic IP blacklisting
- **Notify Admin**: Send alerts to administrators
- **Escalate**: Trigger incident response procedures
- **Log Only**: Record event without action

## Database Schema

### Security Events
```sql
CREATE TABLE security_events (
  id UUID PRIMARY KEY,
  type VARCHAR NOT NULL,
  severity VARCHAR NOT NULL,
  ip_address INET NOT NULL,
  user_id VARCHAR,
  description TEXT NOT NULL,
  metadata JSONB,
  blocked BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### Blacklisted IPs
```sql
CREATE TABLE blacklisted_ips (
  id UUID PRIMARY KEY,
  ip_address INET UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  threat_score INTEGER NOT NULL,
  expires_at TIMESTAMP,
  is_permanent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Examples

### Check Security Metrics
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/security/metrics?timeRange=24h
```

### View Active Alerts
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/security/alerts
```

### Manually Blacklist IP
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Manual block", "durationMinutes": 60}' \
  http://localhost:3000/security/blacklist/192.168.1.100
```

### Test Threat Detection
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "/api/users", "body": {"username": "admin'; DROP TABLE users--"}}' \
  http://localhost:3000/security/test-threat-detection
```

## Monitoring & Maintenance

### Health Checks
- Automatic cleanup of expired blacklists (hourly)
- Alert cleanup (every 10 minutes)
- Metrics cache refresh (every 5 minutes)
- Threat pattern analysis (hourly)

### Log Analysis
- Security events logged with structured data
- Threat trends tracked over time
- Performance metrics for system health

### Alert Management
- Real-time alert dashboard
- Acknowledgment system
- Escalation procedures
- Alert history and analytics

## Security Best Practices

1. **Regular Updates**: Keep threat patterns and rules updated
2. **Monitoring**: Continuous monitoring of security metrics
3. **Testing**: Regular testing of detection capabilities
4. **Response**: Quick response to critical alerts
5. **Review**: Periodic review of blocked IPs and false positives

## Integration Points

- **Notifications**: Integrates with existing notification system
- **WebSocket**: Real-time alerts via WebSocket connections
- **Database**: Stores events in PostgreSQL with TypeORM
- **Cache**: Uses Redis for performance optimization
- **Scheduler**: Automated tasks with NestJS Schedule module

## Future Enhancements

- Machine learning-based anomaly detection
- Integration with external threat intelligence feeds
- Advanced behavioral analysis
- Automated incident reporting
- SIEM integration
- Multi-factor alert verification