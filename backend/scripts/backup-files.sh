#!/bin/bash

# PetChain File Storage Backup Script
# This script creates automated backups of file storage (uploads, documents, etc.)

set -euo pipefail

# Configuration
SOURCE_DIR="${SOURCE_DIR:-./uploads}"
BACKUP_DIR="${BACKUP_DIR:-/backups/files}"
S3_BUCKET="${S3_BUCKET:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="files_backup_${TIMESTAMP}.tar.gz"
EXCLUDE_FILE="${EXCLUDE_FILE:-/tmp/backup_exclude.txt}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Error handling
trap 'log "ERROR: File backup failed at line $LINENO"' ERR

log "Starting file storage backup from $SOURCE_DIR"

# Create exclude file for temporary and cache files
cat > "$EXCLUDE_FILE" << EOF
*.tmp
*.cache
*.log
node_modules/
.git/
.DS_Store
Thumbs.db
*.swp
*.swo
*~
EOF

# Check if source directory exists
if [[ ! -d "$SOURCE_DIR" ]]; then
    log "WARNING: Source directory $SOURCE_DIR does not exist, creating empty backup"
    mkdir -p "$SOURCE_DIR"
fi

# Create file backup
log "Creating file archive..."
tar \
    --exclude-from="$EXCLUDE_FILE" \
    -czf "$BACKUP_DIR/$BACKUP_FILE" \
    -C "$(dirname "$SOURCE_DIR")" \
    "$(basename "$SOURCE_DIR")" || {
        log "WARNING: Some files could not be backed up, continuing..."
    }

# Verify backup integrity
log "Verifying backup integrity..."
if ! tar -tzf "$BACKUP_DIR/$BACKUP_FILE" > /dev/null; then
    log "ERROR: Backup verification failed"
    exit 1
fi

# Calculate backup size and file count
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
FILE_COUNT=$(tar -tzf "$BACKUP_DIR/$BACKUP_FILE" | wc -l)
log "Backup created successfully: $BACKUP_FILE"
log "Archive size: $BACKUP_SIZE, Files: $FILE_COUNT"

# Upload to S3 if configured
if [[ -n "$S3_BUCKET" ]]; then
    log "Uploading backup to S3..."
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$S3_BUCKET/file-backups/$BACKUP_FILE" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256
    
    # Set S3 object metadata
    log "Setting S3 object metadata..."
    aws s3api put-object-tagging \
        --bucket "$S3_BUCKET" \
        --key "file-backups/$BACKUP_FILE" \
        --tagging 'TagSet=[{Key=BackupType,Value=Files},{Key=Created,Value='$TIMESTAMP'},{Key=Environment,Value=production},{Key=FileCount,Value='$FILE_COUNT'}]'
fi

# Create file manifest
MANIFEST_FILE="$BACKUP_DIR/file_manifest_${TIMESTAMP}.txt"
log "Creating file manifest..."
tar -tzf "$BACKUP_DIR/$BACKUP_FILE" > "$MANIFEST_FILE"

# Clean up old local backups
log "Cleaning up local backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "file_manifest_*.txt" -type f -mtime +$RETENTION_DAYS -delete

# Clean up old S3 backups if configured
if [[ -n "$S3_BUCKET" ]]; then
    log "Cleaning up S3 backups older than $RETENTION_DAYS days..."
    aws s3 ls "s3://$S3_BUCKET/file-backups/" | \
    while read -r line; do
        createDate=$(echo "$line" | awk '{print $1" "$2}')
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date -d "$RETENTION_DAYS days ago" +%s)
        if [[ $createDate -lt $olderThan ]]; then
            fileName=$(echo "$line" | awk '{print $4}')
            if [[ $fileName != "" ]]; then
                aws s3 rm "s3://$S3_BUCKET/file-backups/$fileName"
                log "Deleted old S3 backup: $fileName"
            fi
        fi
    done
fi

# Create backup metadata
METADATA_FILE="$BACKUP_DIR/files_backup_metadata_${TIMESTAMP}.json"
cat > "$METADATA_FILE" << EOF
{
    "backup_type": "files",
    "source_directory": "$SOURCE_DIR",
    "backup_file": "$BACKUP_FILE",
    "backup_size": "$BACKUP_SIZE",
    "file_count": "$FILE_COUNT",
    "manifest_file": "file_manifest_${TIMESTAMP}.txt",
    "timestamp": "$TIMESTAMP",
    "retention_days": "$RETENTION_DAYS",
    "s3_bucket": "$S3_BUCKET",
    "success": true
}
EOF

# Cleanup
rm -f "$EXCLUDE_FILE"

log "File storage backup completed successfully"
log "Metadata saved to: $METADATA_FILE"
log "Manifest saved to: $MANIFEST_FILE"

exit 0
