# Database Migration System

This document describes the robust database migration system implemented for the PetChain application using TypeORM with automated execution, rollback capabilities, and CI/CD integration.

## Overview

The migration system provides:
- **Version Control**: Track database schema changes over time
- **Automated Execution**: Run migrations programmatically via CLI or API
- **Rollback Capabilities**: Safely revert migrations when needed
- **CI/CD Integration**: Automated testing and deployment of migrations
- **Comprehensive Testing**: Validation and testing procedures for migrations

## Architecture

### Core Components

1. **MigrationService** (`src/modules/migration/migration.service.ts`)
   - Core service handling all migration operations
   - Provides status checking, execution, rollback, and validation
   - Handles database connection management

2. **MigrationController** (`src/modules/migration/migration.controller.ts`)
   - REST API endpoints for migration management
   - Swagger documentation for all endpoints
   - HTTP status codes and error handling

3. **MigrationCliService** (`src/modules/migration/migration-cli.service.ts`)
   - Command-line interface for migration operations
   - Colored output and detailed logging
   - Help system and command validation

4. **CLI Entry Point** (`src/modules/migration/cli.ts`)
   - NestJS application context for CLI operations
   - Error handling and graceful shutdown

## Usage

### Command Line Interface

The system provides npm scripts for easy access:

```bash
# Check migration status
npm run migration:status

# Run pending migrations
npm run migration:run

# Rollback last migration
npm run migration:rollback

# Generate new migration file
npm run migration:generate <migration-name>

# Validate all migration files
npm run migration:validate

# Show help
npm run migration:help
```

### Advanced CLI Options

```bash
# Run migrations without transaction
npm run migration:run -- --no-transaction

# Rollback to specific version
npm run migration:rollback -- --to=1739000000000-pets-schema-and-sharing

# Generate migration with specific name
npm run migration:generate add-user-preferences
```

### REST API Endpoints

The migration system exposes the following endpoints:

#### GET /migrations/status
Returns current migration status including executed and pending migrations.

**Response:**
```json
{
  "pending": ["migration1", "migration2"],
  "executed": ["migration3", "migration4"],
  "lastExecuted": "migration4",
  "totalPending": 2,
  "totalExecuted": 2
}
```

#### POST /migrations/run
Executes all pending migrations.

**Query Parameters:**
- `transaction` (optional): Run migrations in a transaction (default: true)

**Response:**
```json
[
  {
    "success": true,
    "migration": "migration1",
    "duration": 150
  }
]
```

#### DELETE /migrations/rollback
Rolls back the last executed migration.

**Response:**
```json
{
  "success": true,
  "rolledBack": ["migration1"],
  "duration": 75
}
```

#### DELETE /migrations/rollback-to-version
Rolls back to a specific migration version.

**Query Parameters:**
- `version` (required): Target migration version

#### POST /migrations/generate
Generates a new migration file.

**Request Body:**
```json
{
  "name": "add-user-preferences"
}
```

**Response:**
```json
{
  "filePath": "/path/to/migration/file.ts"
}
```

#### GET /migrations/validate
Validates all migration files for correct structure.

**Response:**
```json
{
  "valid": true,
  "errors": []
}
```

## Migration File Structure

All migration files follow this naming convention:
```
{timestamp}-{description}.ts
```

Example: `1739000000000-pets-schema-and-sharing.ts`

### Migration Template

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExampleMigration1739000000000 implements MigrationInterface {
  name = '1739000000000-example-migration';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add your migration logic here
    await queryRunner.query(`
      CREATE TABLE example_table (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT PK_example_table PRIMARY KEY (id)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add your rollback logic here
    await queryRunner.query(`DROP TABLE example_table`);
  }
}
```

## Best Practices

### Writing Migrations

1. **Always implement down() method**: Ensure migrations can be rolled back
2. **Use IF EXISTS/IF NOT EXISTS**: Make migrations idempotent where possible
3. **Use transactions**: Wrap multiple operations in transactions
4. **Test rollbacks**: Verify that down() methods work correctly
5. **Use descriptive names**: Make migration names clear and specific

### Migration Validation

The system automatically validates migrations for:
- Implementation of `MigrationInterface`
- Presence of `up()` method
- Presence of `down()` method
- Correct file naming convention

### Error Handling

- Migrations run in transactions by default
- Failed migrations trigger automatic rollback
- Detailed error messages and logging
- Graceful handling of connection issues

## CI/CD Integration

### GitHub Actions Workflow

The system includes a comprehensive GitHub Actions workflow (`.github/workflows/migrations.yml`) that:

1. **Tests migrations** on every push/PR to migration files
2. **Validates migration structure** and syntax
3. **Runs migrations** against test database
4. **Tests rollback functionality**
5. **Deploys to staging** automatically on main branch
6. **Allows manual production deployment** via workflow dispatch

### Environment Configuration

Configure environment variables for each environment:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=petchain
DB_LOGGING=false
```

### Deployment Script

Use the provided deployment script for safe migrations:

```bash
# Deploy to staging
./scripts/migration-deploy.sh --env staging --action run

# Dry run on production
./scripts/migration-deploy.sh --env production --action run --dry-run

# Deploy with automatic rollback on failure
./scripts/migration-deploy.sh --env staging --action run --rollback-on-failure
```

## Testing

### Unit Tests

Run unit tests for migration services:

```bash
npm test -- migration.test.ts
```

### Integration Tests

The CI/CD pipeline includes comprehensive integration tests:
- Migration execution against test database
- Rollback functionality testing
- Validation testing
- Error scenario testing

### Manual Testing

1. **Test in development**: Always test migrations in development first
2. **Staging validation**: Run migrations against staging database
3. **Production readiness**: Validate production deployment before execution

## Monitoring and Logging

### Logging Levels

- **INFO**: Migration execution status, completion times
- **WARN**: Validation errors, skipped operations
- **ERROR**: Migration failures, connection issues

### Monitoring Metrics

Track these metrics for migration health:
- Migration execution time
- Success/failure rates
- Rollback frequency
- Database connection issues

## Troubleshooting

### Common Issues

1. **Connection timeouts**: Check database connectivity and credentials
2. **Migration conflicts**: Ensure no concurrent migration executions
3. **Rollback failures**: Verify down() methods are correct
4. **Validation errors**: Check migration file structure and naming

### Recovery Procedures

1. **Failed migrations**: Use rollback or manual intervention
2. **Database corruption**: Restore from backup (automatically created)
3. **Stuck migrations**: Check migrations table and manually update status

## Security Considerations

- **Database credentials**: Store securely in environment variables
- **Migration access**: Limit migration execution to authorized users
- **Audit logging**: Track all migration operations
- **Backup strategy**: Always backup before production migrations

## Performance Optimization

- **Batch operations**: Group related SQL operations
- **Index management**: Add/remove indexes efficiently
- **Large datasets**: Consider chunking large data migrations
- **Connection pooling**: Optimize database connection settings

## Version Control Strategy

### Branch Strategy

- **Feature branches**: Create migrations in feature branches
- **Main branch**: Merge tested migrations to main
- **Production releases**: Tag releases with migration versions

### Migration Dependencies

- **Order dependencies**: Ensure migrations run in correct order
- **Cross-table dependencies**: Handle foreign key constraints properly
- **Data migrations**: Separate schema and data migrations when possible

## Future Enhancements

Planned improvements to the migration system:

1. **Migration scheduling**: Schedule migrations for specific times
2. **Multi-database support**: Support for different database types
3. **Migration dependencies**: Define explicit migration dependencies
4. **Advanced rollback**: Point-in-time rollback capabilities
5. **Performance monitoring**: Built-in performance metrics and alerts

## Support

For issues or questions about the migration system:

1. Check this documentation
2. Review error logs and messages
3. Run validation commands
4. Contact the development team

---

**Last Updated**: 2025-01-09
**Version**: 1.0.0
