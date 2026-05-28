#!/bin/bash

# PetChain Database Backup Script
# This script creates automated backups of the PostgreSQL database

set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-petchain_db}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/backups/database}"
S3_BUCKET="${S3_BUCKET:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${DB_NAME}_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Error handling
trap 'log "ERROR: Backup failed at line $LINENO"' ERR

log "Starting database backup for $DB_NAME"

# Create database backup
log "Creating database dump..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --clean \
    --if-exists \
    --format=custom \
    --compress=9 \
    --file="$BACKUP_DIR/$BACKUP_FILE"

# Compress backup
log "Compressing backup file..."
gzip "$BACKUP_DIR/$BACKUP_FILE"

# Verify backup integrity
log "Verifying backup integrity..."
if ! gzip -t "$BACKUP_DIR/$COMPRESSED_FILE"; then
    log "ERROR: Backup verification failed"
    exit 1
fi

# Calculate backup size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$COMPRESSED_FILE" | cut -f1)
log "Backup created successfully: $COMPRESSED_FILE (Size: $BACKUP_SIZE)"

# Upload to S3 if configured
if [[ -n "$S3_BUCKET" ]]; then
    log "Uploading backup to S3..."
    aws s3 cp "$BACKUP_DIR/$COMPRESSED_FILE" "s3://$S3_BUCKET/database-backups/$COMPRESSED_FILE" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256
    
    # Enable S3 versioning and lifecycle rules
    log "Setting S3 object metadata..."
    aws s3api put-object-tagging \
        --bucket "$S3_BUCKET" \
        --key "database-backups/$COMPRESSED_FILE" \
        --tagging 'TagSet=[{Key=BackupType,Value=Database},{Key=Created,Value='$TIMESTAMP'},{Key=Environment,Value=production}]'
fi

# Clean up old local backups
log "Cleaning up local backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS -delete

# Clean up old S3 backups if configured
if [[ -n "$S3_BUCKET" ]]; then
    log "Cleaning up S3 backups older than $RETENTION_DAYS days..."
    aws s3 ls "s3://$S3_BUCKET/database-backups/" | \
    while read -r line; do
        createDate=$(echo "$line" | awk '{print $1" "$2}')
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date -d "$RETENTION_DAYS days ago" +%s)
        if [[ $createDate -lt $olderThan ]]; then
            fileName=$(echo "$line" | awk '{print $4}')
            if [[ $fileName != "" ]]; then
                aws s3 rm "s3://$S3_BUCKET/database-backups/$fileName"
                log "Deleted old S3 backup: $fileName"
            fi
        fi
    done
fi

# Create backup metadata
METADATA_FILE="$BACKUP_DIR/backup_metadata_${TIMESTAMP}.json"
cat > "$METADATA_FILE" << EOF
{
    "backup_type": "database",
    "database_name": "$DB_NAME",
    "backup_file": "$COMPRESSED_FILE",
    "backup_size": "$BACKUP_SIZE",
    "timestamp": "$TIMESTAMP",
    "retention_days": "$RETENTION_DAYS",
    "s3_bucket": "$S3_BUCKET",
    "success": true
}
EOF

log "Database backup completed successfully"
log "Metadata saved to: $METADATA_FILE"

exit 0
