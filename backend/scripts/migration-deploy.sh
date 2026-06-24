#!/bin/bash

# Migration Deployment Script
# This script handles database migrations for different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="staging"
ACTION="status"
DRY_RUN=false
BACKUP_DB=true
ROLLBACK_ON_FAILURE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --action)
      ACTION="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-backup)
      BACKUP_DB=false
      shift
      ;;
    --rollback-on-failure)
      ROLLBACK_ON_FAILURE=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --env <environment>     Target environment (staging|production) [default: staging]"
      echo "  --action <action>       Migration action (status|run|rollback|validate) [default: status]"
      echo "  --dry-run               Show what would be done without executing"
      echo "  --no-backup             Skip database backup"
      echo "  --rollback-on-failure   Automatically rollback on migration failure"
      echo "  -h, --help              Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0 --env staging --action run"
      echo "  $0 --env production --action status --dry-run"
      echo "  $0 --env staging --action rollback --rollback-on-failure"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo -e "${RED}Error: Environment must be 'staging' or 'production'${NC}"
  exit 1
fi

# Validate action
if [[ "$ACTION" != "status" && "$ACTION" != "run" && "$ACTION" != "rollback" && "$ACTION" != "validate" ]]; then
  echo -e "${RED}Error: Action must be 'status', 'run', 'rollback', or 'validate'${NC}"
  exit 1
fi

# Load environment variables
ENV_FILE=".env.${ENVIRONMENT}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo -e "${RED}Error: Environment file $ENV_FILE not found${NC}"
  exit 1
fi

echo -e "${BLUE}Loading environment from $ENV_FILE${NC}"
export $(cat "$ENV_FILE" | xargs)
cd backend

# Function to create database backup
create_backup() {
  if [[ "$BACKUP_DB" != true ]]; then
    echo -e "${YELLOW}Skipping database backup${NC}"
    return
  fi

  echo -e "${BLUE}Creating database backup...${NC}"
  BACKUP_FILE="backup_${ENVIRONMENT}_$(date +%Y%m%d_%H%M%S).sql"
  
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}[DRY RUN] Would create backup: $BACKUP_FILE${NC}"
    return
  fi

  PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USERNAME" \
    -d "$DB_DATABASE" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    > "../backups/$BACKUP_FILE"

  if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Backup created: ../backups/$BACKUP_FILE${NC}"
  else
    echo -e "${RED}❌ Backup failed${NC}"
    exit 1
  fi
}

# Function to run migration command
run_migration_command() {
  local cmd=$1
  local description=$2

  echo -e "${BLUE}$description...${NC}"
  
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}[DRY RUN] Would execute: npm run migration:$cmd${NC}"
    return
  fi

  if npm run migration:$cmd; then
    echo -e "${GREEN}✅ $description completed successfully${NC}"
    return 0
  else
    echo -e "${RED}❌ $description failed${NC}"
    return 1
  fi
}

# Function to handle rollback on failure
handle_failure() {
  if [[ "$ROLLBACK_ON_FAILURE" == true && "$ACTION" == "run" ]]; then
    echo -e "${YELLOW}Attempting rollback due to failure...${NC}"
    run_migration_command "rollback" "Rolling back migrations"
  fi
}

# Main execution
main() {
  echo -e "${BLUE}=== Migration Deployment Script ===${NC}"
  echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
  echo -e "${BLUE}Action: $ACTION${NC}"
  echo -e "${BLUE}Dry Run: $DRY_RUN${NC}"
  echo -e "${BLUE}Backup DB: $BACKUP_DB${NC}"
  echo -e "${BLUE}Rollback on Failure: $ROLLBACK_ON_FAILURE${NC}"
  echo ""

  # Create backups directory if it doesn't exist
  mkdir -p ../backups

  # Create backup before running migrations
  if [[ "$ACTION" == "run" ]]; then
    create_backup
  fi

  # Execute the requested action
  case $ACTION in
    "status")
      run_migration_command "status" "Checking migration status"
      ;;
    "validate")
      run_migration_command "validate" "Validating migrations"
      ;;
    "run")
      if run_migration_command "run" "Running migrations"; then
        echo -e "${GREEN}🎉 Migration deployment completed successfully!${NC}"
      else
        handle_failure
        exit 1
      fi
      ;;
    "rollback")
      if run_migration_command "rollback" "Rolling back migrations"; then
        echo -e "${GREEN}🎉 Rollback completed successfully!${NC}"
      else
        exit 1
      fi
      ;;
  esac

  echo ""
  echo -e "${BLUE}=== Migration deployment completed ===${NC}"
}

# Error handling
trap 'echo -e "\n${RED}❌ Script interrupted${NC}"; exit 1' INT TERM

# Run main function
main
