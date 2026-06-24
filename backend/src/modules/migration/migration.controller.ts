import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
  MigrationService,
  MigrationStatus,
  MigrationResult,
  RollbackResult,
} from './migration.service';

@ApiTags('migrations')
@Controller('migrations')
export class MigrationController {
  private readonly logger = new Logger(MigrationController.name);

  constructor(private readonly migrationService: MigrationService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get migration status' })
  @ApiResponse({
    status: 200,
    description: 'Migration status retrieved successfully',
  })
  async getStatus(): Promise<MigrationStatus> {
    return this.migrationService.getMigrationStatus();
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run pending migrations' })
  @ApiResponse({ status: 200, description: 'Migrations executed successfully' })
  @ApiResponse({ status: 500, description: 'Migration execution failed' })
  @ApiQuery({
    name: 'transaction',
    required: false,
    type: Boolean,
    description: 'Run migrations in a transaction',
  })
  async runMigrations(
    @Query('transaction') transaction?: string,
  ): Promise<MigrationResult[]> {
    const useTransaction = transaction !== 'false';
    this.logger.log(
      `Starting migration execution (transaction: ${useTransaction})`,
    );

    try {
      const results = await this.migrationService.runMigrations({
        transaction: useTransaction,
      });

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      this.logger.log(
        `Migration execution completed: ${successCount} success, ${failureCount} failed`,
      );

      return results;
    } catch (error) {
      this.logger.error('Migration execution failed', error);
      throw error;
    }
  }

  @Delete('rollback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rollback the last migration' })
  @ApiResponse({
    status: 200,
    description: 'Migration rolled back successfully',
  })
  @ApiResponse({ status: 500, description: 'Rollback failed' })
  async rollbackLast(): Promise<RollbackResult> {
    this.logger.log('Starting rollback of last migration');

    try {
      const result = await this.migrationService.rollbackLastMigration();

      if (result.success) {
        this.logger.log(
          `Rollback completed: ${result.rolledBack.length} migrations rolled back`,
        );
      } else {
        this.logger.error('Rollback failed', result.error);
      }

      return result;
    } catch (error) {
      this.logger.error('Rollback failed', error);
      throw error;
    }
  }

  @Delete('rollback-to-version')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rollback to a specific migration version' })
  @ApiResponse({
    status: 200,
    description: 'Rollback to version completed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid target version' })
  @ApiResponse({ status: 500, description: 'Rollback failed' })
  @ApiQuery({
    name: 'version',
    required: true,
    type: String,
    description: 'Target migration version',
  })
  async rollbackToVersion(
    @Query('version') version: string,
  ): Promise<RollbackResult> {
    this.logger.log(`Starting rollback to version: ${version}`);

    try {
      const result = await this.migrationService.rollbackToVersion(version);

      if (result.success) {
        this.logger.log(
          `Rollback to version ${version} completed: ${result.rolledBack.length} migrations rolled back`,
        );
      } else {
        this.logger.error(
          `Rollback to version ${version} failed`,
          result.error,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Rollback to version ${version} failed`, error);
      throw error;
    }
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate a new migration file' })
  @ApiResponse({
    status: 201,
    description: 'Migration file generated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid migration name' })
  async generateMigration(
    @Body('name') name: string,
  ): Promise<{ filePath: string }> {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error(
        'Migration name is required and must be a non-empty string',
      );
    }

    this.logger.log(`Generating new migration: ${name}`);

    try {
      const filePath = await this.migrationService.generateMigration(
        name.trim(),
      );
      this.logger.log(`Migration generated successfully: ${filePath}`);

      return { filePath };
    } catch (error) {
      this.logger.error(`Failed to generate migration: ${name}`, error);
      throw error;
    }
  }

  @Get('validate')
  @ApiOperation({ summary: 'Validate all migration files' })
  @ApiResponse({ status: 200, description: 'Migration validation completed' })
  async validateMigrations(): Promise<{ valid: boolean; errors: string[] }> {
    this.logger.log('Starting migration validation');

    try {
      const result = await this.migrationService.validateMigrations();

      if (result.valid) {
        this.logger.log('All migrations are valid');
      } else {
        this.logger.warn(
          `Migration validation failed with ${result.errors.length} errors`,
        );
        result.errors.forEach((error) => this.logger.warn(error));
      }

      return result;
    } catch (error) {
      this.logger.error('Migration validation failed', error);
      throw error;
    }
  }
}
