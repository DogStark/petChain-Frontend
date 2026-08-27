#!/bin/bash

# PetChain Disaster Recovery Script
# Automated disaster recovery procedures for system restoration

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RECOVERY_DIR="${RECOVERY_DIR:-/recovery}"
LOG_DIR="${LOG_DIR:-/var/log/petchain}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/disaster_recovery_${TIMESTAMP}.log"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Recovery modes
RECOVERY_MODE="${RECOVERY_MODE:-full}"  # full, database, files, config
BACKUP_TIMESTAMP="${BACKUP_TIMESTAMP:-}"  # Specific backup to restore
DRY_RUN="${DRY_RUN:-false}"  # Test mode without making changes

# Create directories
mkdir -p "$RECOVERY_DIR" "$LOG_DIR"

# Logging function
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message" | tee -a "$LOG_FILE"
}

# Error handling
trap 'log "ERROR: Disaster recovery failed at line $LINENO"; send_notification "DISASTER RECOVERY FAILED" "Recovery process encountered an error at line $LINENO"; exit 1' ERR

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

# System health check
system_health_check() {
    log "Performing system health check..."
    
    local issues=()
    
    # Check disk space
    local available_space=$(df "$RECOVERY_DIR" | awk 'NR==2 {print $4}')
    local required_space=2097152  # 2GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        issues+=("Insufficient disk space: ${available_space}KB available, ${required_space}KB required")
    fi
    
    # Check memory
    local available_memory=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [[ $available_memory -lt 1024 ]]; then
        issues+=("Low memory: ${available_memory}MB available")
    fi
    
    # Check network connectivity
    if ! ping -c 1 8.8.8.8 > /dev/null 2>&1; then
        issues+=("Network connectivity issues")
    fi
    
    # Check Docker
    if ! docker --version > /dev/null 2>&1; then
        issues+=("Docker not installed or not running")
    fi
    
    # Check database tools
    if ! command -v psql > /dev/null 2>&1; then
        issues+=("PostgreSQL client not available")
    fi
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        log "WARNING: System health issues detected:"
        for issue in "${issues[@]}"; do
            log "  - $issue"
        done
        return 1
    fi
    
    log "System health check passed"
    return 0
}

# Find latest backup
find_latest_backup() {
    local backup_type="$1"
    local backup_dir="$BACKUP_DIR/$backup_type"
    
    if [[ -n "$BACKUP_TIMESTAMP" ]]; then
        # Use specific backup timestamp
        local pattern="*${BACKUP_TIMESTAMP}*"
    else
        # Use latest backup
        local pattern="*"
    fi
    
    case "$backup_type" in
        "database")
            find "$backup_dir" -name "petchain_db_backup_${pattern}.gz" -type f | sort -r | head -1
            ;;
        "files")
            find "$backup_dir" -name "files_backup_${pattern}.tar.gz" -type f | sort -r | head -1
            ;;
        "config")
            find "$backup_dir" -name "config_backup_${pattern}.tar.gz" -type f | sort -r | head -1
            ;;
        *)
            log "ERROR: Unknown backup type: $backup_type"
            return 1
            ;;
    esac
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log "Verifying backup integrity: $backup_file"
    
    if [[ ! -f "$backup_file" ]]; then
        log "ERROR: Backup file not found: $backup_file"
        return 1
    fi
    
    # Check file size
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    if [[ $file_size -eq 0 ]]; then
        log "ERROR: Backup file is empty: $backup_file"
        return 1
    fi
    
    # Test archive integrity
    if [[ "$backup_file" == *.gz ]]; then
        if ! gzip -t "$backup_file" 2>/dev/null; then
            log "ERROR: Backup file is corrupted: $backup_file"
            return 1
        fi
    elif [[ "$backup_file" == *.tar.gz ]]; then
        if ! tar -tzf "$backup_file" > /dev/null 2>&1; then
            log "ERROR: Backup archive is corrupted: $backup_file"
            return 1
        fi
    fi
    
    log "Backup integrity verified: $backup_file"
    return 0
}

# Stop services
stop_services() {
    log "Stopping services..."
    
    # Stop application containers
    if docker-compose ps | grep -q "Up"; then
        log "Stopping Docker containers..."
        docker-compose down || log "WARNING: Failed to stop some containers"
    fi
    
    # Stop database if running separately
    if pgrep -f "postgres" > /dev/null; then
        log "Stopping PostgreSQL service..."
        sudo systemctl stop postgresql || log "WARNING: Failed to stop PostgreSQL"
    fi
    
    log "Services stopped"
}

# Start services
start_services() {
    log "Starting services..."
    
    # Start database
    sudo systemctl start postgresql || log "WARNING: Failed to start PostgreSQL"
    
    # Wait for database to be ready
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; then
            break
        fi
        log "Waiting for database to be ready... ($retries retries left)"
        sleep 2
        retries=$((retries - 1))
    done
    
    if [[ $retries -eq 0 ]]; then
        log "ERROR: Database failed to start"
        return 1
    fi
    
    # Start application containers
    log "Starting Docker containers..."
    docker-compose up -d || log "WARNING: Failed to start some containers"
    
    log "Services started"
}

# Restore database
restore_database() {
    local backup_file="$1"
    
    log "Starting database recovery from: $backup_file"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would restore database from $backup_file"
        return 0
    fi
    
    # Create recovery directory
    local db_recovery_dir="$RECOVERY_DIR/database"
    mkdir -p "$db_recovery_dir"
    
    # Extract backup
    log "Extracting database backup..."
    gunzip -c "$backup_file" > "$db_recovery_dir/restore.sql"
    
    # Drop existing database (if it exists)
    log "Dropping existing database (if exists)..."
    PGPASSWORD="$DB_PASSWORD" dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        --if-exists "$DB_NAME" || log "WARNING: Failed to drop existing database"
    
    # Create new database
    log "Creating new database..."
    PGPASSWORD="$DB_PASSWORD" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    
    # Restore database
    log "Restoring database data..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$DB_NAME" -f "$db_recovery_dir/restore.sql"
    
    # Verify restore
    log "Verifying database restore..."
    local table_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [[ $table_count -gt 0 ]]; then
        log "Database restore successful: $table_count tables restored"
    else
        log "ERROR: Database restore verification failed"
        return 1
    fi
    
    # Cleanup
    rm -rf "$db_recovery_dir"
    
    log "Database recovery completed"
    return 0
}

# Restore files
restore_files() {
    local backup_file="$1"
    
    log "Starting file recovery from: $backup_file"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would restore files from $backup_file"
        return 0
    fi
    
    # Create recovery directory
    local files_recovery_dir="$RECOVERY_DIR/files"
    mkdir -p "$files_recovery_dir"
    
    # Extract backup
    log "Extracting file backup..."
    tar -xzf "$backup_file" -C "$files_recovery_dir"
    
    # Restore files to original location
    local source_dir="$SOURCE_DIR:-./uploads"
    if [[ -d "$files_recovery_dir/uploads" ]]; then
        log "Restoring files to $source_dir..."
        
        # Backup existing files (if any)
        if [[ -d "$source_dir" ]]; then
            mv "$source_dir" "${source_dir}.backup.$TIMESTAMP"
        fi
        
        # Restore files
        mkdir -p "$(dirname "$source_dir")"
        mv "$files_recovery_dir/uploads" "$source_dir"
        
        # Set proper permissions
        chmod -R 755 "$source_dir"
        
        log "Files restored to $source_dir"
    else
        log "WARNING: No uploads directory found in backup"
    fi
    
    # Cleanup
    rm -rf "$files_recovery_dir"
    
    log "File recovery completed"
    return 0
}

# Restore configuration
restore_config() {
    local backup_file="$1"
    
    log "Starting configuration recovery from: $backup_file"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would restore configuration from $backup_file"
        return 0
    fi
    
    # Create recovery directory
    local config_recovery_dir="$RECOVERY_DIR/config"
    mkdir -p "$config_recovery_dir"
    
    # Extract backup
    log "Extracting configuration backup..."
    tar -xzf "$backup_file" -C "$config_recovery_dir"
    
    # Restore configuration files
    local config_files=(
        "docker-compose.yml"
        "docker-compose.prod.yml"
        "package.json"
        ".env.production"
        ".env.staging"
        "nest-cli.json"
        "tsconfig.json"
    )
    
    for config_file in "${config_files[@]}"; do
        if [[ -f "$config_recovery_dir/$config_file" ]]; then
            log "Restoring $config_file..."
            
            # Backup existing config
            if [[ -f "$config_file" ]]; then
                cp "$config_file" "${config_file}.backup.$TIMESTAMP"
            fi
            
            # Restore config
            cp "$config_recovery_dir/$config_file" "./"
        fi
    done
    
    # Restore directories
    local config_dirs=("ssl" "nginx" "k8s" "monitoring" ".docker")
    
    for config_dir in "${config_dirs[@]}"; do
        if [[ -d "$config_recovery_dir/$config_dir" ]]; then
            log "Restoring $config_dir directory..."
            
            # Backup existing directory
            if [[ -d "$config_dir" ]]; then
                mv "$config_dir" "${config_dir}.backup.$TIMESTAMP"
            fi
            
            # Restore directory
            mv "$config_recovery_dir/$config_dir" "./"
        fi
    done
    
    # Restore Vault secrets if available
    if [[ -d "$config_recovery_dir/vault" ]]; then
        log "Restoring Vault secrets..."
        # Implementation depends on Vault setup
        log "WARNING: Vault secret restoration requires manual intervention"
    fi
    
    # Cleanup
    rm -rf "$config_recovery_dir"
    
    log "Configuration recovery completed"
    return 0
}

# Post-recovery validation
post_recovery_validation() {
    log "Performing post-recovery validation..."
    
    local validation_issues=()
    
    # Check database connectivity
    if ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; then
        validation_issues+=("Database connectivity failed")
    fi
    
    # Check application health
    if [[ -f "docker-compose.yml" ]]; then
        local container_status=$(docker-compose ps -q | xargs docker inspect --format='{{.State.Status}}' | grep -v "running" | wc -l)
        if [[ $container_status -gt 0 ]]; then
            validation_issues+=("Some containers are not running")
        fi
    fi
    
    # Check file accessibility
    local source_dir="${SOURCE_DIR:-./uploads}"
    if [[ ! -d "$source_dir" ]]; then
        validation_issues+=("Uploads directory not accessible")
    fi
    
    if [[ ${#validation_issues[@]} -gt 0 ]]; then
        log "WARNING: Post-recovery validation issues:"
        for issue in "${validation_issues[@]}"; do
            log "  - $issue"
        done
        return 1
    fi
    
    log "Post-recovery validation passed"
    return 0
}

# Generate recovery report
generate_recovery_report() {
    local report_file="$RECOVERY_DIR/recovery_report_${TIMESTAMP}.json"
    
    log "Generating recovery report..."
    
    cat > "$report_file" << EOF
{
    "recovery_session": {
        "timestamp": "$TIMESTAMP",
        "recovery_mode": "$RECOVERY_MODE",
        "backup_timestamp": "$BACKUP_TIMESTAMP",
        "dry_run": "$DRY_RUN",
        "recovery_directory": "$RECOVERY_DIR",
        "log_file": "$LOG_FILE",
        "success": true
    },
    "system_info": {
        "hostname": "$(hostname)",
        "os_version": "$(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)",
        "disk_usage": "$(df -h "$RECOVERY_DIR" | tail -1)",
        "memory_usage": "$(free -h | grep Mem)"
    }
}
EOF
    
    log "Recovery report generated: $report_file"
}

# Main recovery function
main() {
    log "=== PetChain Disaster Recovery Started ==="
    log "Recovery mode: $RECOVERY_MODE"
    log "Backup timestamp: ${BACKUP_TIMESTAMP:-latest}"
    log "Dry run: $DRY_RUN"
    
    # Send start notification
    send_notification "DISASTER RECOVERY STARTED" "Recovery process started in $RECOVERY_MODE mode"
    
    # System health check
    if ! system_health_check; then
        log "ERROR: System health check failed"
        send_notification "DISASTER RECOVERY FAILED" "System health check failed"
        exit 1
    fi
    
    local recovery_start_time=$(date +%s)
    
    # Stop services
    stop_services
    
    # Perform recovery based on mode
    case "$RECOVERY_MODE" in
        "full")
            # Database recovery
            local db_backup=$(find_latest_backup "database")
            if [[ -n "$db_backup" ]] && verify_backup "$db_backup"; then
                restore_database "$db_backup"
            else
                log "ERROR: No valid database backup found"
                exit 1
            fi
            
            # Files recovery
            local files_backup=$(find_latest_backup "files")
            if [[ -n "$files_backup" ]] && verify_backup "$files_backup"; then
                restore_files "$files_backup"
            else
                log "WARNING: No valid files backup found, skipping files recovery"
            fi
            
            # Configuration recovery
            local config_backup=$(find_latest_backup "config")
            if [[ -n "$config_backup" ]] && verify_backup "$config_backup"; then
                restore_config "$config_backup"
            else
                log "WARNING: No valid configuration backup found, skipping config recovery"
            fi
            ;;
            
        "database")
            local db_backup=$(find_latest_backup "database")
            if [[ -n "$db_backup" ]] && verify_backup "$db_backup"; then
                restore_database "$db_backup"
            else
                log "ERROR: No valid database backup found"
                exit 1
            fi
            ;;
            
        "files")
            local files_backup=$(find_latest_backup "files")
            if [[ -n "$files_backup" ]] && verify_backup "$files_backup"; then
                restore_files "$files_backup"
            else
                log "ERROR: No valid files backup found"
                exit 1
            fi
            ;;
            
        "config")
            local config_backup=$(find_latest_backup "config")
            if [[ -n "$config_backup" ]] && verify_backup "$config_backup"; then
                restore_config "$config_backup"
            else
                log "ERROR: No valid configuration backup found"
                exit 1
            fi
            ;;
            
        *)
            log "ERROR: Unknown recovery mode: $RECOVERY_MODE"
            exit 1
            ;;
    esac
    
    # Start services
    start_services
    
    # Post-recovery validation
    if ! post_recovery_validation; then
        log "WARNING: Post-recovery validation failed"
    fi
    
    local recovery_end_time=$(date +%s)
    local recovery_duration=$((recovery_end_time - recovery_start_time))
    
    # Generate recovery report
    generate_recovery_report
    
    # Send completion notification
    local message="Disaster recovery completed successfully in ${recovery_duration}s"
    send_notification "DISASTER RECOVERY COMPLETED" "$message"
    
    log "=== PetChain Disaster Recovery Completed ==="
    log "Duration: ${recovery_duration} seconds"
    log "Mode: $RECOVERY_MODE"
    
    exit 0
}

# Execute main function
main "$@"
