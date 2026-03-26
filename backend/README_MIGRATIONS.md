# Quick Start Guide - Database Migration System

This guide provides quick instructions for using the database migration system in the PetChain application.

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Environment variables configured

## Environment Setup

Create environment files for different environments:

```bash
# Development (.env)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=petchain_dev
DB_LOGGING=true

# Staging (.env.staging)
DB_HOST=staging-db.example.com
DB_PORT=5432
DB_USERNAME=staging_user
DB_PASSWORD=staging_password
DB_DATABASE=petchain_staging
DB_LOGGING=false

# Production (.env.production)
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_USERNAME=prod_user
DB_PASSWORD=prod_password
DB_DATABASE=petchain_prod
DB_LOGGING=false
```

## Basic Usage

### 1. Check Migration Status

```bash
npm run migration:status
```

### 2. Create a New Migration

```bash
npm run migration:generate add-user-profile
```

This creates a new file in `src/database/migrations/` with the template.

### 3. Edit the Migration File

Open the generated migration file and add your schema changes:

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE user_profiles (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      bio text,
      avatar_url varchar(500),
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT PK_user_profiles PRIMARY KEY (id),
      CONSTRAINT FK_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`DROP TABLE user_profiles`);
}
```

### 4. Validate the Migration

```bash
npm run migration:validate
```

### 5. Run the Migration

```bash
npm run migration:run
```

### 6. Verify the Migration

```bash
npm run migration:status
```

## Rollback Operations

### Rollback Last Migration

```bash
npm run migration:rollback
```

### Rollback to Specific Version

```bash
npm run migration:rollback -- --to=1739000000000-pets-schema-and-sharing
```

## Deployment

### Deploy to Staging

```bash
./scripts/migration-deploy.sh --env staging --action run
```

### Deploy to Production (Dry Run)

```bash
./scripts/migration-deploy.sh --env production --action run --dry-run
```

### Deploy to Production

```bash
./scripts/migration-deploy.sh --env production --action run
```

## Common Scenarios

### Adding a New Column

```bash
npm run migration:generate add-email-to-users
```

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar(255) NULL
  `);
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE users DROP COLUMN email`);
}
```

### Creating a New Table

```bash
npm run migration:generate create-categories-table
```

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE categories (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      name varchar(100) NOT NULL,
      description text,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT PK_categories PRIMARY KEY (id),
      CONSTRAINT UQ_categories_name UNIQUE (name)
    )
  `);
  
  await queryRunner.query(`
    CREATE INDEX IDX_categories_name ON categories (name)
  `);
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`DROP INDEX IF EXISTS IDX_categories_name`);
  await queryRunner.query(`DROP TABLE categories`);
}
```

### Adding Foreign Key Constraint

```bash
npm run migration:generate add-post-author-constraint
```

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    ALTER TABLE posts 
    ADD CONSTRAINT FK_posts_author 
    FOREIGN KEY (author_id) REFERENCES users(id) 
    ON DELETE SET NULL
  `);
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE posts DROP CONSTRAINT FK_posts_author`);
}
```

## API Usage

You can also manage migrations via the REST API:

### Get Migration Status

```bash
curl -X GET http://localhost:3000/migrations/status
```

### Run Migrations

```bash
curl -X POST http://localhost:3000/migrations/run
```

### Rollback Migration

```bash
curl -X DELETE http://localhost:3000/migrations/rollback
```

## Troubleshooting

### Migration Failed

1. Check the error message
2. Fix the issue in the migration file
3. Rollback if needed: `npm run migration:rollback`
4. Fix and re-run: `npm run migration:run`

### Database Connection Issues

1. Verify database is running
2. Check environment variables
3. Test connection: `npm run migration:status`

### Validation Errors

1. Run `npm run migration:validate` to see specific errors
2. Ensure migration file implements `MigrationInterface`
3. Check that both `up()` and `down()` methods exist

## Best Practices

1. **Always test migrations** in development first
2. **Write rollback logic** for every migration
3. **Use descriptive names** for migrations
4. **Keep migrations small** and focused
5. **Backup before production** deployments
6. **Review migrations** in pull requests

## Getting Help

- Run `npm run migration:help` for CLI help
- Check the full documentation: `docs/MIGRATION_SYSTEM.md`
- Review migration files in `src/database/migrations/` for examples

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 5432 |
| `DB_USERNAME` | Database username | postgres |
| `DB_PASSWORD` | Database password | postgres |
| `DB_DATABASE` | Database name | petchain |
| `DB_LOGGING` | Enable query logging | false |

## Migration File Naming

Migrations use timestamp-based naming: `{timestamp}-{description}.ts`

Example: `1739000000000-add-user-profile.ts`

The timestamp ensures proper ordering of migrations.
