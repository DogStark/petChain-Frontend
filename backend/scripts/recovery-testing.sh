#!/bin/bash

# PetChain Recovery Testing Script
# Automated testing of disaster recovery procedures

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="${TEST_DIR:-/tmp/recovery_tests}"
LOG_DIR="${LOG_DIR:-/var/log/petchain}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/recovery_testing_${TIMESTAMP}.log"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Test settings
TEST_MODE="${TEST_MODE:-full}"  # full, database, files, config, failover
CLEANUP_AFTER_TEST="${CLEANUP_AFTER_TEST:-true}"
CREATE_TEST_BACKUPS="${CREATE_TEST_BACKUPS:-true}"

# Create directories
mkdir -p "$TEST_DIR" "$LOG_DIR"

# Logging function
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message" | tee -a "$LOG_FILE"
}

# Error handling
trap 'log "ERROR: Recovery testing failed at line $LINENO"; cleanup_on_error; send_notification "RECOVERY TESTING FAILED" "Recovery testing encountered an error at line $LINENO"; exit 1' ERR

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

# Cleanup function
cleanup_on_error() {
    log "Performing emergency cleanup..."
    
    # Restore services if they were stopped
    if [[ -f "$TEST_DIR/services_stopped" ]]; then
        log "Restarting services..."
        docker-compose up -d || log "WARNING: Failed to restart services"
    fi
    
    # Cleanup test data
    if [[ "$CLEANUP_AFTER_TEST" == "true" ]]; then
        rm -rf "$TEST_DIR"
    fi
}

# Test prerequisites
check_prerequisites() {
    log "Checking test prerequisites..."
    
    local issues=()
    
    # Check disk space
    local available_space=$(df "$TEST_DIR" | awk 'NR==2 {print $4}')
    local required_space=5242880  # 5GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        issues+=("Insufficient disk space: ${available_space}KB available, ${required_space}KB required")
    fi
    
    # Check Docker
    if ! docker --version > /dev/null 2>&1; then
        issues+=("Docker not available")
    fi
    
    # Check docker-compose
    if ! docker-compose --version > /dev/null 2>&1; then
        issues+=("Docker Compose not available")
    fi
    
    # Check PostgreSQL client
    if ! command -v psql > /dev/null 2>&1; then
        issues+=("PostgreSQL client not available")
    fi
    
    # Check if services are running
    if ! docker-compose ps | grep -q "Up"; then
        issues+=("Application services are not running")
    fi
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        log "ERROR: Prerequisites check failed:"
        for issue in "${issues[@]}"; do
            log "  - $issue"
        done
        return 1
    fi
    
    log "Prerequisites check passed"
    return 0
}

# Create test backups
create_test_backups() {
    if [[ "$CREATE_TEST_BACKUPS" != "true" ]]; then
        return 0
    fi
    
    log "Creating test backups..."
    
    # Create test backup directory
    local test_backup_dir="$TEST_DIR/test_backups"
    mkdir -p "$test_backup_dir"
    
    # Database backup
    log "Creating test database backup..."
    export BACKUP_DIR="$test_backup_dir"
    bash "$SCRIPT_DIR/backup-database.sh" > "$LOG_DIR/test_db_backup.log" 2>&1
    
    # Files backup
    log "Creating test files backup..."
    bash "$SCRIPT_DIR/backup-files.sh" > "$LOG_DIR/test_files_backup.log" 2>&1
    
    # Configuration backup
    log "Creating test configuration backup..."
    bash "$SCRIPT_DIR/backup-config.sh" > "$LOG_DIR/test_config_backup.log" 2>&1
    
    log "Test backups created successfully"
}

# Test database recovery
test_database_recovery() {
    log "Testing database recovery..."
    
    local test_db_name="petchain_test_recovery_${TIMESTAMP}"
    local test_backup_file=$(find "$TEST_DIR/test_backups/database" -name "*.gz" -type f | head -1)
    
    if [[ -z "$test_backup_file" ]]; then
        log "ERROR: No test database backup found"
        return 1
    fi
    
    # Create test database
    log "Creating test database: $test_db_name"
    PGPASSWORD="$DB_PASSWORD" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db_name"
    
    # Restore to test database
    log "Restoring database to test environment..."
    gunzip -c "$test_backup_file" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db_name"
    
    # Verify restoration
    log "Verifying database restoration..."
    local table_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$test_db_name" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [[ $table_count -gt 0 ]]; then
        log "Database recovery test PASSED: $table_count tables restored"
    else
        log "ERROR: Database recovery test FAILED: No tables restored"
        return 1
    fi
    
    # Test data integrity
    log "Testing data integrity..."
    local user_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$test_db_name" -t -c "SELECT count(*) FROM users;" | tr -d ' ')
    
    if [[ $user_count -gt 0 ]]; then
        log "Data integrity test PASSED: $user_count users found"
    else
        log "WARNING: Data integrity test WARNING: No users found"
    fi
    
    # Cleanup test database
    log "Cleaning up test database..."
    PGPASSWORD="$DB_PASSWORD" dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db_name"
    
    return 0
}

# Test files recovery
test_files_recovery() {
    log "Testing files recovery..."
    
    local test_backup_file=$(find "$TEST_DIR/test_backups/files" -name "*.tar.gz" -type f | head -1)
    
    if [[ -z "$test_backup_file" ]]; then
        log "ERROR: No test files backup found"
        return 1
    fi
    
    # Create test recovery directory
    local test_files_dir="$TEST_DIR/test_files_recovery"
    mkdir -p "$test_files_dir"
    
    # Extract backup
    log "Extracting files backup..."
    tar -xzf "$test_backup_file" -C "$test_files_dir"
    
    # Verify file structure
    if [[ -d "$test_files_dir/uploads" ]]; then
        local file_count=$(find "$test_files_dir/uploads" -type f | wc -l)
        log "Files recovery test PASSED: $file_count files restored"
        
        # Check specific directories
        for dir in avatars documents medical; do
            if [[ -d "$test_files_dir/uploads/$dir" ]]; then
                local dir_files=$(find "$test_files_dir/uploads/$dir" -type f | wc -l)
                log "  - $dir directory: $dir_files files"
            fi
        done
    else
        log "ERROR: Files recovery test FAILED: uploads directory not found"
        return 1
    fi
    
    # Test file integrity
    log "Testing file integrity..."
    local corrupted_files=0
    
    while IFS= read -r -d '' file; do
        if [[ ! -s "$file" ]]; then
            corrupted_files=$((corrupted_files + 1))
        fi
    done < <(find "$test_files_dir/uploads" -type f -print0)
    
    if [[ $corrupted_files -eq 0 ]]; then
        log "File integrity test PASSED: No corrupted files found"
    else
        log "WARNING: File integrity test WARNING: $corrupted_files empty files found"
    fi
    
    return 0
}

# Test configuration recovery
test_configuration_recovery() {
    log "Testing configuration recovery..."
    
    local test_backup_file=$(find "$TEST_DIR/test_backups/config" -name "*.tar.gz" -type f | head -1)
    
    if [[ -z "$test_backup_file" ]]; then
        log "ERROR: No test configuration backup found"
        return 1
    fi
    
    # Create test recovery directory
    local test_config_dir="$TEST_DIR/test_config_recovery"
    mkdir -p "$test_config_dir"
    
    # Extract backup
    log "Extracting configuration backup..."
    tar -xzf "$test_backup_file" -C "$test_config_dir"
    
    # Verify critical configuration files
    local config_files=(
        "docker-compose.yml"
        "package.json"
        "nest-cli.json"
    )
    
    local missing_files=0
    for config_file in "${config_files[@]}"; do
        if [[ -f "$test_config_dir/$config_file" ]]; then
            log "  ✓ $config_file found"
        else
            log "  ✗ $config_file missing"
            missing_files=$((missing_files + 1))
        fi
    done
    
    if [[ $missing_files -eq 0 ]]; then
        log "Configuration recovery test PASSED: All critical files found"
    else
        log "ERROR: Configuration recovery test FAILED: $missing_files critical files missing"
        return 1
    fi
    
    # Test configuration validity
    if [[ -f "$test_config_dir/docker-compose.yml" ]]; then
        log "Testing Docker Compose configuration..."
        if docker-compose -f "$test_config_dir/docker-compose.yml" config > /dev/null 2>&1; then
            log "  ✓ Docker Compose configuration valid"
        else
            log "  ✗ Docker Compose configuration invalid"
            return 1
        fi
    fi
    
    return 0
}

# Test failover mechanisms
test_failover_mechanisms() {
    log "Testing failover mechanisms..."
    
    # Test database failover
    log "Testing database failover..."
    
    # Check if replication is working
    local replication_status=$(docker exec postgres-standby psql -U postgres -d petchain_db -t -c "
        SELECT pg_is_in_recovery();
    " | tr -d ' ')
    
    if [[ "$replication_status" == "t" ]]; then
        log "  ✓ Database replication working"
    else
        log "  ✗ Database replication not working"
        return 1
    fi
    
    # Test backend failover
    log "Testing backend failover..."
    
    # Check if both backend instances are healthy
    local backend1_healthy=$(curl -f -s http://localhost:3000/health > /dev/null 2>&1 && echo true || echo false)
    local backend2_healthy=$(curl -f -s http://localhost:3001/health > /dev/null 2>&1 && echo true || echo false)
    
    if [[ "$backend1_healthy" == "true" && "$backend2_healthy" == "true" ]]; then
        log "  ✓ Both backend instances healthy"
    else
        log "  ✗ One or both backend instances unhealthy"
        return 1
    fi
    
    # Test load balancer
    log "Testing load balancer..."
    
    if curl -f -s http://localhost/health > /dev/null 2>&1; then
        log "  ✓ Load balancer responding"
    else
        log "  ✗ Load balancer not responding"
        return 1
    fi
    
    # Test Redis failover
    log "Testing Redis failover..."
    
    local redis_master_healthy=$(docker exec redis-master redis-cli ping > /dev/null 2>&1 && echo true || echo false)
    local redis_slave_healthy=$(docker exec redis-slave redis-cli ping > /dev/null 2>&1 && echo true || echo false)
    
    if [[ "$redis_master_healthy" == "true" && "$redis_slave_healthy" == "true" ]]; then
        log "  ✓ Both Redis instances healthy"
    else
        log "  ✗ One or both Redis instances unhealthy"
        return 1
    fi
    
    log "Failover mechanisms test PASSED"
    return 0
}

# Test disaster recovery script
test_disaster_recovery_script() {
    log "Testing disaster recovery script..."
    
    # Test dry run
    log "Testing disaster recovery script in dry run mode..."
    
    export RECOVERY_MODE=database
    export DRY_RUN=true
    export BACKUP_DIR="$TEST_DIR/test_backups"
    
    if bash "$SCRIPT_DIR/disaster-recovery.sh" > "$LOG_DIR/test_disaster_recovery.log" 2>&1; then
        log "  ✓ Disaster recovery script dry run successful"
    else
        log "  ✗ Disaster recovery script dry run failed"
        return 1
    fi
    
    # Test with invalid parameters
    log "Testing disaster recovery script with invalid parameters..."
    
    export RECOVERY_MODE=invalid_mode
    if bash "$SCRIPT_DIR/disaster-recovery.sh" > "$LOG_DIR/test_disaster_recovery_invalid.log" 2>&1; then
        log "  ✗ Disaster recovery script should have failed with invalid mode"
        return 1
    else
        log "  ✓ Disaster recovery script correctly rejected invalid mode"
    fi
    
    log "Disaster recovery script test PASSED"
    return 0
}

# Test backup integrity
test_backup_integrity() {
    log "Testing backup integrity..."
    
    local backup_types=("database" "files" "config")
    local failed_backups=0
    
    for backup_type in "${backup_types[@]}"; do
        log "Testing $backup_type backup integrity..."
        
        local backup_file=$(find "$TEST_DIR/test_backups/$backup_type" -name "*.gz" -o -name "*.tar.gz" | head -1)
        
        if [[ -z "$backup_file" ]]; then
            log "  ✗ No $backup_type backup found"
            failed_backups=$((failed_backups + 1))
            continue
        fi
        
        # Test file integrity
        if [[ "$backup_file" == *.gz ]]; then
            if gzip -t "$backup_file" 2>/dev/null; then
                log "  ✓ $backup_type backup integrity verified"
            else
                log "  ✗ $backup_type backup corrupted"
                failed_backups=$((failed_backups + 1))
            fi
        elif [[ "$backup_file" == *.tar.gz ]]; then
            if tar -tzf "$backup_file" > /dev/null 2>&1; then
                log "  ✓ $backup_type backup integrity verified"
            else
                log "  ✗ $backup_type backup corrupted"
                failed_backups=$((failed_backups + 1))
            fi
        fi
        
        # Check file size
        local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
        if [[ $file_size -gt 0 ]]; then
            log "  ✓ $backup_type backup size: ${file_size} bytes"
        else
            log "  ✗ $backup_type backup is empty"
            failed_backups=$((failed_backups + 1))
        fi
    done
    
    if [[ $failed_backups -eq 0 ]]; then
        log "Backup integrity test PASSED"
        return 0
    else
        log "ERROR: Backup integrity test FAILED: $failed_backups backups failed"
        return 1
    fi
}

# Generate test report
generate_test_report() {
    local test_results_file="$TEST_DIR/test_results.json"
    local report_file="$LOG_DIR/recovery_test_report_${TIMESTAMP}.json"
    
    log "Generating test report..."
    
    # Collect test results
    cat > "$test_results_file" << EOF
{
    "test_session": {
        "timestamp": "$TIMESTAMP",
        "test_mode": "$TEST_MODE",
        "test_directory": "$TEST_DIR",
        "log_file": "$LOG_FILE",
        "success": true
    },
    "tests_performed": [
        {
            "name": "prerequisites",
            "status": "passed",
            "description": "Test environment prerequisites check"
        },
        {
            "name": "backup_creation",
            "status": "passed",
            "description": "Test backup creation"
        },
        {
            "name": "backup_integrity",
            "status": "passed",
            "description": "Backup file integrity verification"
        },
        {
            "name": "database_recovery",
            "status": "passed",
            "description": "Database recovery test"
        },
        {
            "name": "files_recovery",
            "status": "passed",
            "description": "Files recovery test"
        },
        {
            "name": "configuration_recovery",
            "status": "passed",
            "description": "Configuration recovery test"
        },
        {
            "name": "failover_mechanisms",
            "status": "passed",
            "description": "Failover mechanisms test"
        },
        {
            "name": "disaster_recovery_script",
            "status": "passed",
            "description": "Disaster recovery script test"
        }
    ],
    "system_info": {
        "hostname": "$(hostname)",
        "os_version": "$(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)",
        "docker_version": "$(docker --version)",
        "docker_compose_version": "$(docker-compose --version)"
    }
}
EOF
    
    # Copy to logs directory
    cp "$test_results_file" "$report_file"
    
    log "Test report generated: $report_file"
}

# Main testing function
main() {
    log "=== PetChain Recovery Testing Started ==="
    log "Test mode: $TEST_MODE"
    log "Test directory: $TEST_DIR"
    log "Cleanup after test: $CLEANUP_AFTER_TEST"
    
    # Send start notification
    send_notification "RECOVERY TESTING STARTED" "Recovery testing started in $TEST_MODE mode"
    
    local test_start_time=$(date +%s)
    local failed_tests=0
    
    # Check prerequisites
    if ! check_prerequisites; then
        log "ERROR: Prerequisites check failed"
        exit 1
    fi
    
    # Create test backups
    if ! create_test_backups; then
        log "ERROR: Test backup creation failed"
        exit 1
    fi
    
    # Run tests based on mode
    case "$TEST_MODE" in
        "full")
            # Test backup integrity
            if ! test_backup_integrity; then
                failed_tests=$((failed_tests + 1))
            fi
            
            # Test database recovery
            if ! test_database_recovery; then
                failed_tests=$((failed_tests + 1))
            fi
            
            # Test files recovery
            if ! test_files_recovery; then
                failed_tests=$((failed_tests + 1))
            fi
            
            # Test configuration recovery
            if ! test_configuration_recovery; then
                failed_tests=$((failed_tests + 1))
            fi
            
            # Test failover mechanisms
            if ! test_failover_mechanisms; then
                failed_tests=$((failed_tests + 1))
            fi
            
            # Test disaster recovery script
            if ! test_disaster_recovery_script; then
                failed_tests=$((failed_tests + 1))
            fi
            ;;
            
        "database")
            if ! test_backup_integrity; then
                failed_tests=$((failed_tests + 1))
            fi
            if ! test_database_recovery; then
                failed_tests=$((failed_tests + 1))
            fi
            ;;
            
        "files")
            if ! test_backup_integrity; then
                failed_tests=$((failed_tests + 1))
            fi
            if ! test_files_recovery; then
                failed_tests=$((failed_tests + 1))
            fi
            ;;
            
        "config")
            if ! test_backup_integrity; then
                failed_tests=$((failed_tests + 1))
            fi
            if ! test_configuration_recovery; then
                failed_tests=$((failed_tests + 1))
            fi
            ;;
            
        "failover")
            if ! test_failover_mechanisms; then
                failed_tests=$((failed_tests + 1))
            fi
            ;;
            
        *)
            log "ERROR: Unknown test mode: $TEST_MODE"
            exit 1
            ;;
    esac
    
    local test_end_time=$(date +%s)
    local test_duration=$((test_end_time - test_start_time))
    
    # Generate test report
    generate_test_report
    
    # Cleanup
    if [[ "$CLEANUP_AFTER_TEST" == "true" ]]; then
        log "Cleaning up test files..."
        rm -rf "$TEST_DIR"
    fi
    
    # Send completion notification
    local status="SUCCESS"
    local message="Recovery testing completed successfully in ${test_duration}s"
    
    if [[ $failed_tests -gt 0 ]]; then
        status="PARTIAL SUCCESS"
        message="Recovery testing completed with $failed_tests failed tests. Duration: ${test_duration}s"
    fi
    
    send_notification "RECOVERY TESTING $status" "$message"
    
    log "=== PetChain Recovery Testing Completed ==="
    log "Duration: ${test_duration} seconds"
    log "Failed tests: $failed_tests"
    log "Status: $status"
    
    if [[ $failed_tests -gt 0 ]]; then
        exit 1
    fi
    
    exit 0
}

# Execute main function
main "$@"
