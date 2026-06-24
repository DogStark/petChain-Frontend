#!/bin/bash

# PetChain Health Monitoring Script
# Continuous monitoring of system health and backup status

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${LOG_DIR:-/var/log/petchain}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/health_monitor_${TIMESTAMP}.log"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
TEAMS_WEBHOOK="${TEAMS_WEBHOOK:-}"

# Monitoring settings
MONITOR_INTERVAL="${MONITOR_INTERVAL:-300}"  # 5 minutes
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-30}"
BACKUP_AGE_WARNING="${BACKUP_AGE_WARNING:-86400}"  # 24 hours
BACKUP_AGE_CRITICAL="${BACKUP_AGE_CRITICAL:-172800}"  # 48 hours
DISK_USAGE_WARNING="${DISK_USAGE_WARNING:-80}"  # 80%
DISK_USAGE_CRITICAL="${DISK_USAGE_CRITICAL:-90}"  # 90%

# Create directories
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message" | tee -a "$LOG_FILE"
}

# Error handling
trap 'log "ERROR: Health monitor failed at line $LINENO"' ERR

# Notification function
send_notification() {
    local severity="$1"
    local title="$2"
    local message="$3"
    
    # Add severity to notification
    local prefix=""
    case "$severity" in
        "CRITICAL")
            prefix="🚨 "
            ;;
        "WARNING")
            prefix="⚠️ "
            ;;
        "INFO")
            prefix="ℹ️ "
            ;;
    esac
    
    local full_title="${prefix}${title}"
    
    # Email notification
    if [[ -n "$NOTIFICATION_EMAIL" ]]; then
        echo "$message" | mail -s "$full_title" "$NOTIFICATION_EMAIL" 2>/dev/null || log "Failed to send email notification"
    fi
    
    # Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local color="good"
        case "$severity" in
            "CRITICAL")
                color="danger"
                ;;
            "WARNING")
                color="warning"
                ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"title\":\"$full_title\",\"text\":\"$message\",\"ts\":$(date +%s)}]}" \
            "$SLACK_WEBHOOK" 2>/dev/null || log "Failed to send Slack notification"
    fi
    
    # Teams notification
    if [[ -n "$TEAMS_WEBHOOK" ]]; then
        local theme_color="00FF00"
        case "$severity" in
            "CRITICAL")
                theme_color="FF0000"
                ;;
            "WARNING")
                theme_color="FFFF00"
                ;;
        esac
        
        curl -X POST -H 'Content-Type: application/json' \
            --data "{\"@type\":\"MessageCard\",\"@context\":\"http://schema.org/extensions\",\"themeColor\":\"$theme_color\",\"summary\":\"$title\",\"sections\":[{\"activityTitle\":\"$full_title\",\"activitySubtitle\":\"$message\",\"markdown\":true}]}" \
            "$TEAMS_WEBHOOK" 2>/dev/null || log "Failed to send Teams notification"
    fi
}

# Check service health
check_service_health() {
    local service_name="$1"
    local health_check_url=""
    local health_check_command=""
    
    case "$service_name" in
        "database")
            health_check_command="docker exec postgres-primary pg_isready -U postgres -d petchain_db"
            ;;
        "database_standby")
            health_check_command="docker exec postgres-standby pg_isready -U postgres -d petchain_db"
            ;;
        "redis")
            health_check_command="docker exec redis-master redis-cli ping"
            ;;
        "backend_primary")
            health_check_url="http://localhost:3000/health"
            ;;
        "backend_secondary")
            health_check_url="http://localhost:3001/health"
            ;;
        "load_balancer")
            health_check_url="http://localhost/health"
            ;;
        *)
            log "ERROR: Unknown service: $service_name"
            return 1
            ;;
    esac
    
    if [[ -n "$health_check_command" ]]; then
        timeout "$HEALTH_CHECK_TIMEOUT" bash -c "$health_check_command" > /dev/null 2>&1
    elif [[ -n "$health_check_url" ]]; then
        curl -f -s --max-time "$HEALTH_CHECK_TIMEOUT" "$health_check_url" > /dev/null 2>&1
    else
        return 1
    fi
}

# Check disk usage
check_disk_usage() {
    local mount_point="${1:-/}"
    local usage=$(df "$mount_point" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $usage -ge $DISK_USAGE_CRITICAL ]]; then
        log "CRITICAL: Disk usage on $mount_point is ${usage}%"
        send_notification "CRITICAL" "Disk Usage Critical" "Disk usage on $mount_point is ${usage}%. Immediate action required."
        return 2
    elif [[ $usage -ge $DISK_USAGE_WARNING ]]; then
        log "WARNING: Disk usage on $mount_point is ${usage}%"
        send_notification "WARNING" "Disk Usage Warning" "Disk usage on $mount_point is ${usage}%. Consider cleanup."
        return 1
    else
        log "Disk usage on $mount_point is ${usage}% - OK"
        return 0
    fi
}

# Check backup age
check_backup_age() {
    local backup_type="$1"
    local backup_dir="${BACKUP_DIR:-/backups}/$backup_type"
    
    if [[ ! -d "$backup_dir" ]]; then
        log "WARNING: Backup directory $backup_dir does not exist"
        return 1
    fi
    
    local latest_backup=$(find "$backup_dir" -name "*.gz" -o -name "*.tar.gz" | sort -r | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        log "CRITICAL: No $backup_type backups found"
        send_notification "CRITICAL" "No Backups Found" "No $backup_type backups found in $backup_dir"
        return 2
    fi
    
    local backup_time=$(stat -c %Y "$latest_backup" 2>/dev/null || stat -f %m "$latest_backup" 2>/dev/null)
    local current_time=$(date +%s)
    local backup_age=$((current_time - backup_time))
    
    if [[ $backup_age -ge $BACKUP_AGE_CRITICAL ]]; then
        local backup_age_hours=$((backup_age / 3600))
        log "CRITICAL: $backup_type backup is $backup_age_hours hours old"
        send_notification "CRITICAL" "Backup Age Critical" "$backup_type backup is $backup_age_hours hours old. Latest: $(basename "$latest_backup")"
        return 2
    elif [[ $backup_age -ge $BACKUP_AGE_WARNING ]]; then
        local backup_age_hours=$((backup_age / 3600))
        log "WARNING: $backup_type backup is $backup_age_hours hours old"
        send_notification "WARNING" "Backup Age Warning" "$backup_type backup is $backup_age_hours hours old. Latest: $(basename "$latest_backup")"
        return 1
    else
        local backup_age_hours=$((backup_age / 3600))
        log "$backup_type backup is $backup_age_hours hours old - OK"
        return 0
    fi
}

# Check database replication
check_database_replication() {
    log "Checking database replication status..."
    
    # Check if standby is in recovery mode
    local recovery_status=$(docker exec postgres-standby psql -U postgres -d petchain_db -t -c "
        SELECT pg_is_in_recovery();
    " | tr -d ' ')
    
    if [[ "$recovery_status" != "t" ]]; then
        log "WARNING: Database standby is not in recovery mode"
        send_notification "WARNING" "Replication Issue" "Database standby is not in recovery mode"
        return 1
    fi
    
    # Check replication lag
    local lag_seconds=$(docker exec postgres-standby psql -U postgres -d petchain_db -t -c "
        SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS lag_seconds;
    " | tr -d ' ')
    
    if [[ -n "$lag_seconds" ]]; then
        local lag_minutes=$((lag_seconds / 60))
        
        if (( $(echo "$lag_seconds > 300" | bc -l) )); then  # 5 minutes
            log "WARNING: Database replication lag is ${lag_minutes} minutes"
            send_notification "WARNING" "High Replication Lag" "Database replication lag is ${lag_minutes} minutes"
            return 1
        else
            log "Database replication lag is ${lag_seconds} seconds - OK"
        fi
    else
        log "WARNING: Could not determine replication lag"
        return 1
    fi
    
    return 0
}

# Check Redis replication
check_redis_replication() {
    log "Checking Redis replication status..."
    
    # Check if slave is connected to master
    local slave_info=$(docker exec redis-slave redis-cli info replication | grep "master_link_status:up")
    
    if [[ -z "$slave_info" ]]; then
        log "WARNING: Redis slave is not connected to master"
        send_notification "WARNING" "Redis Replication Issue" "Redis slave is not connected to master"
        return 1
    else
        log "Redis replication is working - OK"
    fi
    
    return 0
}

# Check load balancer health
check_load_balancer() {
    log "Checking load balancer health..."
    
    # Check if NGINX is running
    if ! docker exec petchain_nginx_lb nginx -t > /dev/null 2>&1; then
        log "CRITICAL: NGINX configuration is invalid"
        send_notification "CRITICAL" "Load Balancer Configuration Error" "NGINX configuration is invalid"
        return 2
    fi
    
    # Check upstream status
    local upstream_status=$(curl -s http://localhost/upstream_status 2>/dev/null | grep -c "up" || echo "0")
    
    if [[ $upstream_status -lt 2 ]]; then
        log "WARNING: Only $upstream_status upstream servers are healthy"
        send_notification "WARNING" "Load Balancer Upstream Issue" "Only $upstream_status upstream servers are healthy"
        return 1
    else
        log "Load balancer is healthy with $upstream_status upstream servers - OK"
    fi
    
    return 0
}

# Check application metrics
check_application_metrics() {
    log "Checking application metrics..."
    
    # Check response time
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost/health 2>/dev/null || echo "0")
    
    if (( $(echo "$response_time > 5.0" | bc -l) )); then
        log "WARNING: Application response time is ${response_time}s"
        send_notification "WARNING" "Slow Response Time" "Application response time is ${response_time}s"
        return 1
    else
        log "Application response time is ${response_time}s - OK"
    fi
    
    # Check memory usage
    local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    
    if [[ $memory_usage -gt 90 ]]; then
        log "WARNING: Memory usage is ${memory_usage}%"
        send_notification "WARNING" "High Memory Usage" "Memory usage is ${memory_usage}%"
        return 1
    else
        log "Memory usage is ${memory_usage}% - OK"
    fi
    
    return 0
}

# Check SSL certificates
check_ssl_certificates() {
    log "Checking SSL certificates..."
    
    local ssl_cert="/etc/nginx/ssl/cert.pem"
    local days_warning=30
    local days_critical=7
    
    if [[ -f "$ssl_cert" ]]; then
        local expiry_date=$(openssl x509 -in "$ssl_cert" -noout -enddate | cut -d= -f2)
        local expiry_timestamp=$(date -d "$expiry_date" +%s)
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [[ $days_until_expiry -le $days_critical ]]; then
            log "CRITICAL: SSL certificate expires in $days_until_expiry days"
            send_notification "CRITICAL" "SSL Certificate Expiry" "SSL certificate expires in $days_until_expiry days"
            return 2
        elif [[ $days_until_expiry -le $days_warning ]]; then
            log "WARNING: SSL certificate expires in $days_until_expiry days"
            send_notification "WARNING" "SSL Certificate Expiry" "SSL certificate expires in $days_until_expiry days"
            return 1
        else
            log "SSL certificate is valid for $days_until_expiry days - OK"
        fi
    else
        log "WARNING: SSL certificate not found"
        return 1
    fi
    
    return 0
}

# Generate health report
generate_health_report() {
    local report_file="$LOG_DIR/health_report_${TIMESTAMP}.json"
    
    log "Generating health report..."
    
    # Collect system information
    local hostname=$(hostname)
    local uptime=$(uptime -p)
    local load_average=$(uptime | awk -F'load average:' '{print $2}')
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}')
    local memory_usage=$(free | grep Mem | awk '{printf "%.0f%%", $3/$2 * 100.0}')
    
    # Count running containers
    local running_containers=$(docker ps --format "table {{.Names}}" | grep -v "NAMES" | wc -l)
    
    # Check service status
    local services_status=""
    for service in database redis backend_primary backend_secondary load_balancer; do
        if check_service_health "$service"; then
            services_status+="$service:healthy,"
        else
            services_status+="$service:unhealthy,"
        fi
    done
    
    # Create report
    cat > "$report_file" << EOF
{
    "health_report": {
        "timestamp": "$TIMESTAMP",
        "hostname": "$hostname",
        "uptime": "$uptime",
        "load_average": "$load_average",
        "system_resources": {
            "disk_usage": "$disk_usage",
            "memory_usage": "$memory_usage",
            "running_containers": $running_containers
        },
        "services_status": "$services_status",
        "monitoring_interval": "$MONITOR_INTERVAL",
        "log_file": "$LOG_FILE"
    }
}
EOF
    
    log "Health report generated: $report_file"
}

# Main monitoring function
main() {
    log "=== PetChain Health Monitor Started ==="
    log "Monitor interval: ${MONITOR_INTERVAL}s"
    log "Health check timeout: ${HEALTH_CHECK_TIMEOUT}s"
    
    # Send start notification
    send_notification "INFO" "Health Monitor Started" "Health monitoring started with ${MONITOR_INTERVAL}s interval"
    
    # Main monitoring loop
    while true; do
        log "Starting health check cycle..."
        
        local issues_found=0
        
        # Check system resources
        check_disk_usage "/" || issues_found=$((issues_found + 1))
        
        # Check services
        for service in database redis backend_primary backend_secondary load_balancer; do
            if ! check_service_health "$service"; then
                log "WARNING: Service $service is unhealthy"
                send_notification "WARNING" "Service Unhealthy" "Service $service is not responding to health checks"
                issues_found=$((issues_found + 1))
            fi
        done
        
        # Check backups
        check_backup_age "database" || issues_found=$((issues_found + 1))
        check_backup_age "files" || issues_found=$((issues_found + 1))
        check_backup_age "config" || issues_found=$((issues_found + 1))
        
        # Check replication
        check_database_replication || issues_found=$((issues_found + 1))
        check_redis_replication || issues_found=$((issues_found + 1))
        
        # Check load balancer
        check_load_balancer || issues_found=$((issues_found + 1))
        
        # Check application metrics
        check_application_metrics || issues_found=$((issues_found + 1))
        
        # Check SSL certificates
        check_ssl_certificates || issues_found=$((issues_found + 1))
        
        # Generate health report
        generate_health_report
        
        if [[ $issues_found -eq 0 ]]; then
            log "Health check cycle completed - All systems OK"
        else
            log "Health check cycle completed - $issues_found issues found"
        fi
        
        log "Waiting ${MONITOR_INTERVAL}s for next check..."
        sleep "$MONITOR_INTERVAL"
    done
}

# Handle signals
trap 'log "Health monitor stopping..."; send_notification "INFO" "Health Monitor Stopped" "Health monitoring service has been stopped"; exit 0' SIGTERM SIGINT

# Start monitoring
main "$@"
