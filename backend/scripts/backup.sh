#!/bin/bash
# Database Backup Script for PetChain

# Configuration
BACKUP_DIR="/var/lib/postgresql/data/backups"
ARCHIVE_DIR="/var/lib/postgresql/data/archive"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="base_backup_${TIMESTAMP}"
RETENTION_DAYS=7

# Ensure backup directory exists
mkdir -p ${BACKUP_DIR}

echo "Starting base backup: ${BACKUP_NAME}..."

# Perform base backup
pg_basebackup -D ${BACKUP_DIR}/${BACKUP_NAME} -Ft -z -X fetch -P

if [ $? -eq 0 ]; then
    echo "Base backup successful: ${BACKUP_NAME}"
    
    # Calculate checksum for integrity verification
    sha256sum ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz > ${BACKUP_DIR}/${BACKUP_NAME}.sha256
    
    # Cleanup old backups
    find ${BACKUP_DIR} -name "base_backup_*" -mtime +${RETENTION_DAYS} -delete
    
    # In production, sync to S3:
    # aws s3 sync ${BACKUP_DIR} s3://petchain-backups/
    # aws s3 sync ${ARCHIVE_DIR} s3://petchain-wal-archive/
else
    echo "Base backup failed!"
    exit 1
fi

echo "Backup process complete."
