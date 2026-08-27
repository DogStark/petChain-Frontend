#!/bin/bash

# PetChain Failover Manager
# Automated failover management for high availability

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${LOG_DIR:-/var/log/petchain}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/failover_manager_${TIMESTAMP}.log"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Service configuration
DATABASE_PRIMARY="${DATABASE_PRIMARY:-postgres-primary}"
DATABASE_STANDBY="${DATABASE_STANDBY:-postgres-standby}"
BACKEND_PRIMARY="${BACKEND_PRIMARY:-backend-primary}"
BACKEND_SECONDARY="${BACKEND_SECONDARY:-backend-secondary}"
REDIS_MASTER="${REDIS_MASTER:-redis-master}"
REDIS_SLAVE="${REDIS_SLAVE:-redis-slave}"

# Failover settings
FAILOVER_CHECK_INTERVAL="${FAILOVER_CHECK_INTERVAL:-60}"
AUTO_FAILOVER_ENABLED="${AUTO_FAILOVER_ENABLED:-true}"
MAX_FAILURES="${MAX_FAILURES:-3}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-10}"

# State tracking
STATE_DIR="/tmp/failover_state"
mkdir -p "$STATE_DIR"

# Logging function
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message" | tee -a "$LOG_FILE"
}

# Error handling
trap 'log "ERROR: Failover manager failed at line $LINENO"' ERR

# Notification function
send_notification() {
    local title="$1"
    local message="$2"
    
    if [[ -n "$NOTIFICATION_EMAIL" ]]; then
        echo "$message" | mail -s "$title" "$NOTIFICATION_EMAIL" 2>/dev/null || log "Failed to send email notification"
    fi
    
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"*$title*\n$message\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || log "Failed to send Slack notification"
    fi
}

# Get failure count for service
get_failure_count() {
    local service="$1"
    local counter_file="$STATE_DIR/${service}_failures"
    
    if [[ -f "$counter_file" ]]; then
        cat "$counter_file"
    else
        echo "0"
    fi
}

# Increment failure count
increment_failure_count() {
    local service="$1"
    local counter_file="$STATE_DIR/${service}_failures"
    local current_count=$(get_failure_count "$service")
    local new_count=$((current_count + 1))
    
    echo "$new_count" > "$counter_file"
    log "$service failure count: $new_count"
    
    echo "$new_count"
}

# Reset failure count
reset_failure_count() {
    local service="$1"
    local counter_file="$STATE_DIR/${service}_failures"
    
    if [[ -f "$counter_file" ]]; then
        rm "$counter_file"
    fi
    
    log "$service failure count reset"
}

# Check service health
check_service_health() {
    local service="$1"
    local health_check_url=""
    local health_check_command=""
    
    case "$service" in
        "$DATABASE_PRIMARY")
            health_check_command="docker exec $DATABASE_PRIMARY pg_isready -U postgres -d petchain_db"
            ;;
        "$DATABASE_STANDBY")
            health_check_command="docker exec $DATABASE_STANDBY pg_isready -U postgres -d petchain_db"
            ;;
        "$BACKEND_PRIMARY")
            health_check_url="http://localhost:3000/health"
            ;;
        "$BACKEND_SECONDARY")
            health_check_url="http://localhost:3001/health"
            ;;
        "$REDIS_MASTER")
            health_check_command="docker exec $REDIS_MASTER redis-cli ping"
            ;;
        "$REDIS_SLAVE")
            health_check_command="docker exec $REDIS_SLAVE redis-cli ping"
            ;;
        *)
            log "ERROR: Unknown service: $service"
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

# Check if service is primary
is_primary_service() {
    local service="$1"
    
    case "$service" in
        "$DATABASE_PRIMARY"|"$BACKEND_PRIMARY"|"$REDIS_MASTER")
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Promote standby to primary
promote_standby() {
    local service_type="$1"
    
    log "Initiating failover for $service_type"
    
    case "$service_type" in
        "database")
            promote_database_standby
            ;;
        "backend")
            promote_backend_secondary
            ;;
        "redis")
            promote_redis_slave
            ;;
        *)
            log "ERROR: Unknown service type: $service_type"
            return 1
            ;;
    esac
}

# Promote database standby
promote_database_standby() {
    log "Promoting database standby to primary"
    
    # Stop replication on standby
    docker exec "$DATABASE_STANDBY" bash -c "
        pg_ctl -D /var/lib/postgresql/data promote
    " || {
        log "ERROR: Failed to promote database standby"
        return 1
    }
    
    # Update application configuration
    update_database_config "$DATABASE_STANDBY"
    
    # Restart backend services to use new primary
    restart_backend_services
    
    log "Database failover completed successfully"
    send_notification "DATABASE FAILOVER COMPLETED" "Database standby promoted to primary. New primary: $DATABASE_STANDBY"
}

# Promote backend secondary
promote_backend_secondary() {
    log "Promoting backend secondary to primary"
    
    # Update load balancer configuration
    update_nginx_config "$BACKEND_SECONDARY"
    
    # Reload NGINX
    docker exec petchain_nginx_lb nginx -s reload || {
        log "ERROR: Failed to reload NGINX"
        return 1
    }
    
    log "Backend failover completed successfully"
    send_notification "BACKEND FAILOVER COMPLETED" "Backend secondary promoted to primary. New primary: $BACKEND_SECONDARY"
}

# Promote Redis slave
promote_redis_slave() {
    log "Promoting Redis slave to master"
    
    # Configure slave as master
    docker exec "$REDIS_SLAVE" bash -c "
        redis-cli SLAVEOF NO ONE
        redis-cli CONFIG SET slave-read-only no
    " || {
        log "ERROR: Failed to promote Redis slave"
        return 1
    }
    
    # Update Redis sentinel configuration
    update_redis_sentinel "$REDIS_SLAVE"
    
    log "Redis failover completed successfully"
    send_notification "REDIS FAILOVER COMPLETED" "Redis slave promoted to master. New master: $REDIS_SLAVE"
}

# Update database configuration
update_database_config() {
    local new_primary="$1"
    
    log "Updating database configuration to use $new_primary"
    
    # This would update environment variables or configuration files
    # Implementation depends on your configuration management approach
    
    # Example: Update docker-compose environment
    sed -i "s/DATABASE_HOST=.*/DATABASE_HOST=$new_primary/" .env
    
    log "Database configuration updated"
}

# Update NGINX configuration
update_nginx_config() {
    local primary_backend="$1"
    
    log "Updating NGINX configuration to prioritize $primary_backend"
    
    # This would update the NGINX upstream configuration
    # Implementation depends on your NGINX setup
    
    log "NGINX configuration updated"
}

# Update Redis sentinel
update_redis_sentinel() {
    local new_master="$1"
    
    log "Updating Redis sentinel to use $new_master as master"
    
    # Update sentinel configuration
    docker exec petchain_redis_sentinel bash -c "
        redis-cli SENTINEL SET mymaster $new_master 6379 2
    " || {
        log "WARNING: Failed to update Redis sentinel"
    }
    
    log "Redis sentinel updated"
}

# Restart backend services
restart_backend_services() {
    log "Restarting backend services"
    
    docker-compose restart backend-primary backend-secondary || {
        log "WARNING: Failed to restart some backend services"
    }
    
    log "Backend services restarted"
}

# Perform failover
perform_failover() {
    local service="$1"
    
    if [[ "$AUTO_FAILOVER_ENABLED" != "true" ]]; then
        log "Auto-failover is disabled. Manual intervention required for $service"
        send_notification "FAILOVER REQUIRED" "Service $service requires manual failover (auto-failover disabled)"
        return 1
    fi
    
    log "Performing automatic failover for $service"
    
    local service_type=""
    case "$service" in
        "$DATABASE_PRIMARY")
            service_type="database"
            ;;
        "$BACKEND_PRIMARY")
            service_type="backend"
            ;;
        "$REDIS_MASTER")
            service_type="redis"
            ;;
        *)
            log "ERROR: Cannot determine failover type for service: $service"
            return 1
            ;;
    esac
    
    if promote_standby "$service_type"; then
        reset_failure_count "$service"
        log "Failover completed successfully for $service"
        return 0
    else
        log "ERROR: Failover failed for $service"
        send_notification "FAILOVER FAILED" "Automatic failover failed for $service. Manual intervention required!"
        return 1
    fi
}

# Monitor service health
monitor_service() {
    local service="$1"
    
    if check_service_health "$service"; then
        log "Service $service is healthy"
        reset_failure_count "$service"
        return 0
    else
        log "WARNING: Service $service is unhealthy"
        local failure_count=$(increment_failure_count "$service")
        
        if [[ $failure_count -ge $MAX_FAILURES ]]; then
            log "CRITICAL: Service $service has failed $failure_count times, initiating failover"
            send_notification "SERVICE FAILURE DETECTED" "Service $service has failed $failure_count times. Initiating failover."
            perform_failover "$service"
        else
            log "Service $service failure count: $failure_count/$MAX_FAILURES"
        fi
        
        return 1
    fi
}

# Monitor all services
monitor_all_services() {
    local services=("$DATABASE_PRIMARY" "$DATABASE_STANDBY" "$BACKEND_PRIMARY" "$BACKEND_SECONDARY" "$REDIS_MASTER" "$REDIS_SLAVE")
    local unhealthy_services=()
    
    for service in "${services[@]}"; do
        if ! monitor_service "$service"; then
            unhealthy_services+=("$service")
        fi
    done
    
    if [[ ${#unhealthy_services[@]} -eq 0 ]]; then
        log "All services are healthy"
    else
        log "Unhealthy services: ${unhealthy_services[*]}"
    fi
}

# Check replication lag
check_replication_lag() {
    log "Checking database replication lag"
    
    local lag=$(docker exec "$DATABASE_STANDBY" psql -U postgres -d petchain_db -t -c "
        SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS lag_seconds;
    " | tr -d ' ')
    
    if [[ -n "$lag" ]]; then
        log "Database replication lag: ${lag} seconds"
        
        # Alert if lag is too high
        if (( $(echo "$lag > 300" | bc -l) )); then
            log "WARNING: High replication lag detected: ${lag} seconds"
            send_notification "HIGH REPLICATION LAG" "Database replication lag is ${lag} seconds"
        fi
    fi
}

# Generate failover report
generate_failover_report() {
    local report_file="$LOG_DIR/failover_report_${TIMESTAMP}.json"
    
    cat > "$report_file" << EOF
{
    "failover_report": {
        "timestamp": "$TIMESTAMP",
        "auto_failover_enabled": "$AUTO_FAILOVER_ENABLED",
        "max_failures": "$MAX_FAILURES",
        "health_check_timeout": "$HEALTH_CHECK_TIMEOUT",
        "services": {
            "database_primary": {
                "healthy": $(check_service_health "$DATABASE_PRIMARY" && echo true || echo false),
                "failure_count": $(get_failure_count "$DATABASE_PRIMARY")
            },
            "database_standby": {
                "healthy": $(check_service_health "$DATABASE_STANDBY" && echo true || echo false),
                "failure_count": $(get_failure_count "$DATABASE_STANDBY")
            },
            "backend_primary": {
                "healthy": $(check_service_health "$BACKEND_PRIMARY" && echo true || echo false),
                "failure_count": $(get_failure_count "$BACKEND_PRIMARY")
            },
            "backend_secondary": {
                "healthy": $(check_service_health "$BACKEND_SECONDARY" && echo true || echo false),
                "failure_count": $(get_failure_count "$BACKEND_SECONDARY")
            },
            "redis_master": {
                "healthy": $(check_service_health "$REDIS_MASTER" && echo true || echo false),
                "failure_count": $(get_failure_count "$REDIS_MASTER")
            },
            "redis_slave": {
                "healthy": $(check_service_health "$REDIS_SLAVE" && echo true || echo false),
                "failure_count": $(get_failure_count "$REDIS_SLAVE")
            }
        }
    }
}
EOF
    
    log "Failover report generated: $report_file"
}

# Main monitoring loop
main() {
    log "=== PetChain Failover Manager Started ==="
    log "Auto-failover enabled: $AUTO_FAILOVER_ENABLED"
    log "Check interval: ${FAILOVER_CHECK_INTERVAL}s"
    log "Max failures: $MAX_FAILURES"
    
    # Initial health check
    monitor_all_services
    
    # Main monitoring loop
    while true; do
        log "Starting health check cycle..."
        
        # Monitor all services
        monitor_all_services
        
        # Check replication lag
        check_replication_lag
        
        # Generate periodic report
        generate_failover_report
        
        log "Health check cycle completed. Waiting ${FAILOVER_CHECK_INTERVAL}s..."
        sleep "$FAILOVER_CHECK_INTERVAL"
    done
}

# Handle signals
trap 'log "Failover manager stopping..."; exit 0' SIGTERM SIGINT

# Start monitoring
main "$@"
