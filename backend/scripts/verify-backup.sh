#!/bin/bash
# Backup Integrity Verification Script

BACKUP_DIR="/var/lib/postgresql/data/backups"

echo "Verifying latest backups..."

# Find the most recent backup
LATEST_BACKUP=$(ls -t ${BACKUP_DIR}/base_backup_*.tar.gz | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "No backups found to verify."
    exit 1
fi

CHECKsum_FILE="${LATEST_BACKUP%.tar.gz}.sha256"

if [ ! -f "$CHECKsum_FILE" ]; then
    echo "Checksum file missing for ${LATEST_BACKUP}"
    exit 1
fi

# Verify checksum
sha256sum -c "$CHECKsum_FILE"

if [ $? -eq 0 ]; then
    echo "Integrity verification successful for ${LATEST_BACKUP}"
else
    echo "Integrity verification FAILED for ${LATEST_BACKUP}!"
    exit 1
fi
