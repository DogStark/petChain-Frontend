import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MigrationExecutor } from 'typeorm/migration/MigrationExecutor';
import { Migration } from 'typeorm/migration/Migration';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface MigrationStatus {
  pending: string[];
  executed: string[];
  lastExecuted?: string;
  totalPending: number;
  totalExecuted: number;
}

export interface MigrationResult {
  success: boolean;
  migration?: string;
  error?: string;
  duration: number;
}

export interface RollbackResult {
  success: boolean;
  rolledBack: string[];
  error?: string;
  duration: number;
}

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);
  private dataSource: DataSource;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeDataSource();
  }

  private async initializeDataSource(): Promise<void> {
    const dbConfig = this.configService.get<DataSourceOptions>('database');
    if (!dbConfig) {
      throw new Error('Database configuration not found');
    }

    this.dataSource = new DataSource(dbConfig);
    try {
      await this.dataSource.initialize();
      this.logger.log('Database connection initialized for migration service');
    } catch (error) {
      this.logger.error('Failed to initialize database connection', error);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<MigrationStatus> {
    if (!this.dataSource.isInitialized) {
      await this.initializeDataSource();
    }

    const migrationExecutor = new MigrationExecutor(this.dataSource);
    const executedMigrations = await migrationExecutor.getExecutedMigrations();
    const pendingMigrations = await migrationExecutor.getPendingMigrations();

    const executed = executedMigrations.map((m) => m.name);
    const pending = pendingMigrations.map((m) => m.name);

    return {
      pending,
      executed,
      lastExecuted:
        executed.length > 0 ? executed[executed.length - 1] : undefined,
      totalPending: pending.length,
      totalExecuted: executed.length,
    };
  }

  async runMigrations(
    options: { transaction?: boolean } = {},
  ): Promise<MigrationResult[]> {
    if (!this.dataSource.isInitialized) {
      await this.initializeDataSource();
    }

    const status = await this.getMigrationStatus();
    if (status.totalPending === 0) {
      this.logger.log('No pending migrations to run');
      return [];
    }

    this.logger.log(`Running ${status.totalPending} pending migrations...`);
    const results: MigrationResult[] = [];

    try {
      const migrationExecutor = new MigrationExecutor(this.dataSource);

      if (options.transaction !== false) {
        await this.dataSource.query('BEGIN');
      }

      for (const migration of status.pending) {
        const startTime = Date.now();
        try {
          await migrationExecutor.executePendingMigrations();
          const duration = Date.now() - startTime;

          results.push({
            success: true,
            migration,
            duration,
          });

          this.logger.log(
            `Migration ${migration} executed successfully (${duration}ms)`,
          );
          break; // executePendingMigrations runs all pending migrations at once
        } catch (error) {
          const duration = Date.now() - startTime;
          results.push({
            success: false,
            migration,
            error: error.message,
            duration,
          });

          this.logger.error(`Migration ${migration} failed`, error);

          if (options.transaction !== false) {
            await this.dataSource.query('ROLLBACK');
          }
          break;
        }
      }

      if (options.transaction !== false && results.every((r) => r.success)) {
        await this.dataSource.query('COMMIT');
        this.logger.log('All migrations committed successfully');
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to run migrations', error);
      if (options.transaction !== false) {
        await this.dataSource.query('ROLLBACK');
      }
      throw error;
    }
  }

  async rollbackLastMigration(): Promise<RollbackResult> {
    if (!this.dataSource.isInitialized) {
      await this.initializeDataSource();
    }

    const startTime = Date.now();
    const status = await this.getMigrationStatus();

    if (status.totalExecuted === 0) {
      this.logger.log('No migrations to rollback');
      return {
        success: true,
        rolledBack: [],
        duration: Date.now() - startTime,
      };
    }

    this.logger.log('Rolling back last migration...');

    try {
      await this.dataSource.query('BEGIN');

      const migrationExecutor = new MigrationExecutor(this.dataSource);
      const lastMigration = status.executed[status.executed.length - 1];

      await migrationExecutor.undoLastMigration();

      await this.dataSource.query('COMMIT');

      const duration = Date.now() - startTime;
      this.logger.log(
        `Migration ${lastMigration} rolled back successfully (${duration}ms)`,
      );

      return {
        success: true,
        rolledBack: [lastMigration],
        duration,
      };
    } catch (error) {
      await this.dataSource.query('ROLLBACK');
      this.logger.error('Failed to rollback migration', error);

      return {
        success: false,
        rolledBack: [],
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  async rollbackToVersion(targetVersion: string): Promise<RollbackResult> {
    if (!this.dataSource.isInitialized) {
      await this.initializeDataSource();
    }

    const startTime = Date.now();
    const status = await this.getMigrationStatus();

    const targetIndex = status.executed.indexOf(targetVersion);
    if (targetIndex === -1) {
      throw new Error(
        `Migration version ${targetVersion} not found in executed migrations`,
      );
    }

    const migrationsToRollback = status.executed.slice(targetIndex + 1);

    if (migrationsToRollback.length === 0) {
      this.logger.log(`No migrations to rollback to version ${targetVersion}`);
      return {
        success: true,
        rolledBack: [],
        duration: Date.now() - startTime,
      };
    }

    this.logger.log(
      `Rolling back ${migrationsToRollback.length} migrations to version ${targetVersion}...`,
    );

    try {
      await this.dataSource.query('BEGIN');

      const migrationExecutor = new MigrationExecutor(this.dataSource);
      const rolledBack: string[] = [];

      for (const migration of migrationsToRollback.reverse()) {
        await migrationExecutor.undoLastMigration();
        rolledBack.push(migration);
        this.logger.log(`Migration ${migration} rolled back`);
      }

      await this.dataSource.query('COMMIT');

      const duration = Date.now() - startTime;
      this.logger.log(
        `Successfully rolled back to version ${targetVersion} (${duration}ms)`,
      );

      return {
        success: true,
        rolledBack,
        duration,
      };
    } catch (error) {
      await this.dataSource.query('ROLLBACK');
      this.logger.error('Failed to rollback migrations', error);

      return {
        success: false,
        rolledBack: [],
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  async generateMigration(name: string): Promise<string> {
    // Sanitize name: only allow alphanumeric, hyphens, underscores
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!safeName) {
      throw new Error('Invalid migration name');
    }
    const timestamp = Date.now();
    const migrationName = `${timestamp}-${safeName}`;
    const migrationPath = path.join(
      process.cwd(),
      'src',
      'database',
      'migrations',
      `${migrationName}.ts`,
    );

    const template = `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${this.toPascalCase(safeName)}${timestamp} implements MigrationInterface {
  name = '${migrationName}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add your migration logic here
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add your rollback logic here
  }
}
`;

    await fs.writeFile(migrationPath, template, 'utf-8');
    this.logger.log(`Generated migration file: ${migrationPath}`);

    return migrationPath;
  }

  async validateMigrations(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const migrationPath = path.join(
        process.cwd(),
        'src',
        'database',
        'migrations',
      );
      const files = await fs.readdir(migrationPath);
      const migrationFiles = files.filter((file) => file.endsWith('.ts'));

      for (const file of migrationFiles) {
        const filePath = path.join(migrationPath, file);
        const content = await fs.readFile(filePath, 'utf-8');

        if (!content.includes('implements MigrationInterface')) {
          errors.push(
            `Migration ${file} does not implement MigrationInterface`,
          );
        }

        if (!content.includes('public async up(')) {
          errors.push(`Migration ${file} missing up() method`);
        }

        if (!content.includes('public async down(')) {
          errors.push(`Migration ${file} missing down() method`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Failed to validate migrations: ${error.message}`);
      return {
        valid: false,
        errors,
      };
    }
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/(?:^|[-_])(\w)/g, (_, char) => char.toUpperCase())
      .replace(/[-_]/g, '');
  }

  async onModuleDestroy() {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
