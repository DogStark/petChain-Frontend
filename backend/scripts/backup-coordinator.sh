#!/bin/bash

# PetChain Backup Coordinator Script
# Orchestrates all backup operations and provides centralized backup management

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
LOG_DIR="${LOG_DIR:-/var/log/petchain}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/backup_coordinator_${TIMESTAMP}.log"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
TEAMS_WEBHOOK="${TEAMS_WEBHOOK:-}"

# Create directories
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Logging function
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message" | tee -a "$LOG_FILE"
}

# Error handling
trap 'log "ERROR: Backup coordinator failed at line $LINENO"; send_notification "BACKUP FAILED" "Backup coordinator encountered an error at line $LINENO"; exit 1' ERR

# Notification functions
send_notification() {
    local title="$1"
    local message="$2"
    
    # Email notification
    if [[ -n "$NOTIFICATION_EMAIL" ]]; then
        echo "$message" | mail -s "$title" "$NOTIFICATION_EMAIL" 2>/dev/null || log "Failed to send email notification"
    fi
    
    # Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"*$title*\n$message\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || log "Failed to send Slack notification"
    fi
    
    # Teams notification
    if [[ -n "$TEAMS_WEBHOOK" ]]; then
        curl -X POST -H 'Content-Type: application/json' \
            --data "{\"title\":\"$title\",\"text\":\"$message\"}" \
            "$TEAMS_WEBHOOK" 2>/dev/null || log "Failed to send Teams notification"
    fi
}

# Backup function with retry
run_backup() {
    local backup_type="$1"
    local script_path="$2"
    local max_retries=3
    local retry_count=0
    
    while [[ $retry_count -lt $max_retries ]]; do
        log "Starting $backup_type backup (attempt $((retry_count + 1))/$max_retries)"
        
        if bash "$script_path" 2>&1 | tee -a "$LOG_FILE"; then
            log "$backup_type backup completed successfully"
            return 0
        else
            retry_count=$((retry_count + 1))
            log "WARNING: $backup_type backup failed (attempt $retry_count/$max_retries)"
            
            if [[ $retry_count -lt $max_retries ]]; then
                log "Retrying $backup_type backup in 30 seconds..."
                sleep 30
            fi
        fi
    done
    
    log "ERROR: $backup_type backup failed after $max_retries attempts"
    return 1
}

# Pre-backup checks
pre_backup_checks() {
    log "Performing pre-backup checks..."
    
    # Check disk space
    local available_space=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    local required_space=1048576  # 1GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        log "ERROR: Insufficient disk space. Available: ${available_space}KB, Required: ${required_space}KB"
        return 1
    fi
    
    # Check database connectivity
    if ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; then
        log "ERROR: Database is not ready for backup"
        return 1
    fi
    
    # Check S3 connectivity if configured
    if [[ -n "$S3_BUCKET" ]]; then
        if ! aws s3 ls "s3://$S3_BUCKET" > /dev/null 2>&1; then
            log "ERROR: Cannot connect to S3 bucket $S3_BUCKET"
            return 1
        fi
    fi
    
    log "Pre-backup checks passed"
    return 0
}

# Post-backup validation
post_backup_validation() {
    log "Performing post-backup validation..."
    
    local backup_count=0
    local failed_backups=0
    
    # Check database backup
    local latest_db_backup=$(find "$BACKUP_DIR/database" -name "*.gz" -type f -mmin -60 | head -1)
    if [[ -n "$latest_db_backup" && -f "$latest_db_backup" ]]; then
        backup_count=$((backup_count + 1))
        log "Database backup validated: $latest_db_backup"
    else
        failed_backups=$((failed_backups + 1))
        log "ERROR: Database backup validation failed"
    fi
    
    # Check files backup
    local latest_files_backup=$(find "$BACKUP_DIR/files" -name "*.tar.gz" -type f -mmin -60 | head -1)
    if [[ -n "$latest_files_backup" && -f "$latest_files_backup" ]]; then
        backup_count=$((backup_count + 1))
        log "Files backup validated: $latest_files_backup"
    else
        failed_backups=$((failed_backups + 1))
        log "ERROR: Files backup validation failed"
    fi
    
    # Check config backup
    local latest_config_backup=$(find "$BACKUP_DIR/config" -name "*.tar.gz" -type f -mmin -60 | head -1)
    if [[ -n "$latest_config_backup" && -f "$latest_config_backup" ]]; then
        backup_count=$((backup_count + 1))
        log "Configuration backup validated: $latest_config_backup"
    else
        failed_backups=$((failed_backups + 1))
        log "ERROR: Configuration backup validation failed"
    fi
    
    log "Backup validation completed: $backup_count successful, $failed_backups failed"
    
    if [[ $failed_backups -gt 0 ]]; then
        return 1
    fi
    
    return 0
}

# Generate backup report
generate_backup_report() {
    local report_file="$BACKUP_DIR/backup_report_${TIMESTAMP}.json"
    
    log "Generating backup report..."
    
    # Collect backup statistics
    local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    local db_backups=$(find "$BACKUP_DIR/database" -name "*.gz" -type f | wc -l)
    local file_backups=$(find "$BACKUP_DIR/files" -name "*.tar.gz" -type f | wc -l)
    local config_backups=$(find "$BACKUP_DIR/config" -name "*.tar.gz" -type f | wc -l)
    
    # Create report
    cat > "$report_file" << EOF
{
    "backup_session": {
        "timestamp": "$TIMESTAMP",
        "total_size": "$total_size",
        "backup_counts": {
            "database": $db_backups,
            "files": $file_backups,
            "configuration": $config_backups
        },
        "backup_directory": "$BACKUP_DIR",
        "log_file": "$LOG_FILE",
        "success": true
    },
    "system_info": {
        "hostname": "$(hostname)",
        "os_version": "$(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)",
        "disk_usage": "$(df -h "$BACKUP_DIR" | tail -1)",
        "memory_usage": "$(free -h | grep Mem)"
    }
}
EOF
    
    log "Backup report generated: $report_file"
}

# Main execution
main() {
    log "=== PetChain Backup Coordinator Started ==="
    log "Timestamp: $TIMESTAMP"
    log "Backup directory: $BACKUP_DIR"
    
    # Pre-backup checks
    if ! pre_backup_checks; then
        send_notification "BACKUP FAILED - PRE-CHECKS" "Pre-backup checks failed. Check logs: $LOG_FILE"
        exit 1
    fi
    
    local backup_start_time=$(date +%s)
    local failed_operations=()
    
    # Run database backup
    if ! run_backup "Database" "$SCRIPT_DIR/backup-database.sh"; then
        failed_operations+=("Database")
    fi
    
    # Run files backup
    if ! run_backup "Files" "$SCRIPT_DIR/backup-files.sh"; then
        failed_operations+=("Files")
    fi
    
    # Run configuration backup
    if ! run_backup "Configuration" "$SCRIPT_DIR/backup-config.sh"; then
        failed_operations+=("Configuration")
    fi
    
    local backup_end_time=$(date +%s)
    local backup_duration=$((backup_end_time - backup_start_time))
    
    # Post-backup validation
    if ! post_backup_validation; then
        send_notification "BACKUP FAILED - VALIDATION" "Post-backup validation failed. Check logs: $LOG_FILE"
        exit 1
    fi
    
    # Generate backup report
    generate_backup_report
    
    # Send completion notification
    local status="SUCCESS"
    local message="Backup completed successfully in ${backup_duration}s"
    
    if [[ ${#failed_operations[@]} -gt 0 ]]; then
        status="PARTIAL SUCCESS"
        message="Backup completed with failures: ${failed_operations[*]}. Duration: ${backup_duration}s"
    fi
    
    send_notification "BACKUP $status" "$message"
    
    log "=== PetChain Backup Coordinator Completed ==="
    log "Duration: ${backup_duration} seconds"
    log "Status: $status"
    
    if [[ ${#failed_operations[@]} -gt 0 ]]; then
        exit 1
    fi
    
    exit 0
}

# Execute main function
main "$@"
