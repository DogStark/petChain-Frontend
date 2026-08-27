#!/bin/bash

# PetChain Configuration Backup Script
# This script backs up application configurations, environment files, and secrets

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/config}"
S3_BUCKET="${S3_BUCKET:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="config_backup_${TIMESTAMP}.tar.gz"
VAULT_ADDR="${VAULT_ADDR:-}"
VAULT_TOKEN="${VAULT_TOKEN:-}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Error handling
trap 'log "ERROR: Configuration backup failed at line $LINENO"' ERR

log "Starting configuration backup"

# Create temporary directory for config files
TEMP_CONFIG_DIR="/tmp/config_backup_${TIMESTAMP}"
mkdir -p "$TEMP_CONFIG_DIR"

# Backup Docker configurations
log "Backing up Docker configurations..."
if [[ -f "docker-compose.yml" ]]; then
    cp docker-compose.yml "$TEMP_CONFIG_DIR/"
fi

if [[ -f "docker-compose.prod.yml" ]]; then
    cp docker-compose.prod.yml "$TEMP_CONFIG_DIR/"
fi

if [[ -d ".docker" ]]; then
    cp -r .docker "$TEMP_CONFIG_DIR/"
fi

# Backup application configurations
log "Backing up application configurations..."
if [[ -f "package.json" ]]; then
    cp package.json "$TEMP_CONFIG_DIR/"
fi

if [[ -f ".env.production" ]]; then
    cp .env.production "$TEMP_CONFIG_DIR/"
fi

if [[ -f ".env.staging" ]]; then
    cp .env.staging "$TEMP_CONFIG_DIR/"
fi

# Backup NestJS configurations
if [[ -f "nest-cli.json" ]]; then
    cp nest-cli.json "$TEMP_CONFIG_DIR/"
fi

if [[ -f "tsconfig.json" ]]; then
    cp tsconfig.json "$TEMP_CONFIG_DIR/"
fi

# Backup SSL certificates
if [[ -d "./ssl" ]]; then
    log "Backing up SSL certificates..."
    cp -r ./ssl "$TEMP_CONFIG_DIR/"
fi

# Backup Nginx configurations
if [[ -d "./nginx" ]]; then
    log "Backing up Nginx configurations..."
    cp -r ./nginx "$TEMP_CONFIG_DIR/"
fi

# Backup Kubernetes manifests
if [[ -d "./k8s" ]]; then
    log "Backing up Kubernetes manifests..."
    cp -r ./k8s "$TEMP_CONFIG_DIR/"
fi

# Backup monitoring configurations
if [[ -d "./monitoring" ]]; then
    log "Backing up monitoring configurations..."
    cp -r ./monitoring "$TEMP_CONFIG_DIR/"
fi

# Backup from HashiCorp Vault if configured
if [[ -n "$VAULT_ADDR" && -n "$VAULT_TOKEN" ]]; then
    log "Backing up secrets from Vault..."
    mkdir -p "$TEMP_CONFIG_DIR/vault"
    
    # Export KV secrets
    vault kv list -format=json secret/ > "$TEMP_CONFIG_DIR/vault/kv_list.json" 2>/dev/null || true
    
    # Export specific secrets
    if vault kv get secret/petchain/database > /dev/null 2>&1; then
        vault kv get -format=json secret/petchain/database > "$TEMP_CONFIG_DIR/vault/database_secrets.json"
    fi
    
    if vault kv get secret/petchain/aws > /dev/null 2>&1; then
        vault kv get -format=json secret/petchain/aws > "$TEMP_CONFIG_DIR/vault/aws_secrets.json"
    fi
    
    if vault kv get secret/petchain/jwt > /dev/null 2>&1; then
        vault kv get -format=json secret/petchain/jwt > "$TEMP_CONFIG_DIR/vault/jwt_secrets.json"
    fi
fi

# Create configuration manifest
log "Creating configuration manifest..."
find "$TEMP_CONFIG_DIR" -type f -exec sha256sum {} \; > "$TEMP_CONFIG_DIR/config_manifest.txt"

# Create backup archive
log "Creating configuration backup archive..."
tar -czf "$BACKUP_DIR/$BACKUP_FILE" -C "$TEMP_CONFIG_DIR" .

# Verify backup integrity
if ! tar -tzf "$BACKUP_DIR/$BACKUP_FILE" > /dev/null; then
    log "ERROR: Configuration backup verification failed"
    exit 1
fi

# Calculate backup size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
CONFIG_COUNT=$(tar -tzf "$BACKUP_DIR/$BACKUP_FILE" | wc -l)
log "Configuration backup created: $BACKUP_FILE"
log "Archive size: $BACKUP_SIZE, Files: $CONFIG_COUNT"

# Upload to S3 if configured
if [[ -n "$S3_BUCKET" ]]; then
    log "Uploading configuration backup to S3..."
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$S3_BUCKET/config-backups/$BACKUP_FILE" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256
    
    # Set S3 object metadata
    aws s3api put-object-tagging \
        --bucket "$S3_BUCKET" \
        --key "config-backups/$BACKUP_FILE" \
        --tagging 'TagSet=[{Key=BackupType,Value=Config},{Key=Created,Value='$TIMESTAMP'},{Key=Environment,Value=production},{Key=ConfigCount,Value='$CONFIG_COUNT'}]'
fi

# Clean up old local backups
log "Cleaning up local configuration backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "config_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete

# Clean up old S3 backups
if [[ -n "$S3_BUCKET" ]]; then
    log "Cleaning up S3 configuration backups older than $RETENTION_DAYS days..."
    aws s3 ls "s3://$S3_BUCKET/config-backups/" | \
    while read -r line; do
        createDate=$(echo "$line" | awk '{print $1" "$2}')
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date -d "$RETENTION_DAYS days ago" +%s)
        if [[ $createDate -lt $olderThan ]]; then
            fileName=$(echo "$line" | awk '{print $4}')
            if [[ $fileName != "" ]]; then
                aws s3 rm "s3://$S3_BUCKET/config-backups/$fileName"
                log "Deleted old S3 config backup: $fileName"
            fi
        fi
    done
fi

# Create backup metadata
METADATA_FILE="$BACKUP_DIR/config_backup_metadata_${TIMESTAMP}.json"
cat > "$METADATA_FILE" << EOF
{
    "backup_type": "configuration",
    "backup_file": "$BACKUP_FILE",
    "backup_size": "$BACKUP_SIZE",
    "config_count": "$CONFIG_COUNT",
    "timestamp": "$TIMESTAMP",
    "retention_days": "$RETENTION_DAYS",
    "s3_bucket": "$S3_BUCKET",
    "vault_enabled": $([ -n "$VAULT_ADDR" ] && echo true || echo false),
    "success": true
}
EOF

# Cleanup temporary directory
rm -rf "$TEMP_CONFIG_DIR"

log "Configuration backup completed successfully"
log "Metadata saved to: $METADATA_FILE"

exit 0
