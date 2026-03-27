import { Injectable, Logger } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { MigrationStatus, MigrationResult, RollbackResult } from './migration.service';

@Injectable()
export class MigrationCliService {
  private readonly logger = new Logger(MigrationCliService.name);

  constructor(private readonly migrationService: MigrationService) {}

  async runCommand(command: string, args: string[]): Promise<void> {
    try {
      switch (command) {
        case 'status':
          await this.showStatus();
          break;
        case 'run':
          await this.runMigrations(args);
          break;
        case 'rollback':
          await this.rollbackMigration(args);
          break;
        case 'generate':
          await this.generateMigration(args);
          break;
        case 'validate':
          await this.validateMigrations();
          break;
        case 'help':
          this.showHelp();
          break;
        default:
          this.logger.error(`Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      this.logger.error(`Command failed: ${error.message}`, error);
      process.exit(1);
    }
  }

  private async showStatus(): Promise<void> {
    console.log('\n📊 Migration Status\n');
    
    const status: MigrationStatus = await this.migrationService.getMigrationStatus();
    
    console.log(`✅ Executed migrations: ${status.totalExecuted}`);
    if (status.executed.length > 0) {
      status.executed.forEach(migration => {
        console.log(`   - ${migration}`);
      });
    }
    
    console.log(`\n⏳ Pending migrations: ${status.totalPending}`);
    if (status.pending.length > 0) {
      status.pending.forEach(migration => {
        console.log(`   - ${migration}`);
      });
    }
    
    if (status.lastExecuted) {
      console.log(`\n🕐 Last executed: ${status.lastExecuted}`);
    }
    
    console.log('\n');
  }

  private async runMigrations(args: string[]): Promise<void> {
    const useTransaction = !args.includes('--no-transaction');
    
    console.log('\n🚀 Running migrations...\n');
    
    const results: MigrationResult[] = await this.migrationService.runMigrations({
      transaction: useTransaction,
    });
    
    if (results.length === 0) {
      console.log('✅ No pending migrations to run.\n');
      return;
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`\n📋 Migration Results:`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    
    results.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      console.log(`   ${icon} ${result.migration} (${duration})`);
      
      if (!result.success && result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });
    
    if (failureCount > 0) {
      console.log('\n❌ Some migrations failed. Check the errors above.\n');
      process.exit(1);
    } else {
      console.log('\n🎉 All migrations executed successfully!\n');
    }
  }

  private async rollbackMigration(args: string[]): Promise<void> {
    const toVersion = args.find(arg => arg.startsWith('--to='))?.split('=')[1];
    
    console.log('\n🔄 Rolling back migrations...\n');
    
    let result: RollbackResult;
    
    if (toVersion) {
      console.log(`Rolling back to version: ${toVersion}`);
      result = await this.migrationService.rollbackToVersion(toVersion);
    } else {
      console.log('Rolling back last migration...');
      result = await this.migrationService.rollbackLastMigration();
    }
    
    if (result.success) {
      if (result.rolledBack.length === 0) {
        console.log('✅ No migrations to rollback.\n');
      } else {
        console.log(`✅ Successfully rolled back ${result.rolledBack.length} migration(s):`);
        result.rolledBack.forEach(migration => {
          console.log(`   - ${migration}`);
        });
        console.log(`\n⏱️  Duration: ${result.duration}ms\n`);
      }
    } else {
      console.log(`❌ Rollback failed: ${result.error}`);
      console.log(`\n⏱️  Duration: ${result.duration}ms\n`);
      process.exit(1);
    }
  }

  private async generateMigration(args: string[]): Promise<void> {
    const name = args[0];
    
    if (!name) {
      console.error('❌ Migration name is required.');
      console.log('Usage: npm run migration:generate <migration-name>\n');
      process.exit(1);
    }
    
    console.log(`\n📝 Generating migration: ${name}\n`);
    
    try {
      const filePath = await this.migrationService.generateMigration(name);
      console.log(`✅ Migration generated successfully:`);
      console.log(`   ${filePath}\n`);
    } catch (error) {
      console.error(`❌ Failed to generate migration: ${error.message}\n`);
      process.exit(1);
    }
  }

  private async validateMigrations(): Promise<void> {
    console.log('\n🔍 Validating migrations...\n');
    
    const result = await this.migrationService.validateMigrations();
    
    if (result.valid) {
      console.log('✅ All migrations are valid!\n');
    } else {
      console.log(`❌ Found ${result.errors.length} validation error(s):`);
      result.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
      console.log('\n');
      process.exit(1);
    }
  }

  private showHelp(): void {
    console.log(`
📚 Migration CLI Help

Usage: npm run migration:<command> [options]

Commands:
  status              Show migration status
  run                 Run pending migrations
  rollback            Rollback last migration
  rollback --to=<version>  Rollback to specific version
  generate <name>     Generate new migration file
  validate            Validate all migration files
  help                Show this help message

Options:
  --no-transaction    Run migrations without transaction (for 'run' command)
  --to=<version>      Target version for rollback (for 'rollback' command)

Examples:
  npm run migration:status
  npm run migration:run
  npm run migration:run -- --no-transaction
  npm run migration:rollback
  npm run migration:rollback -- --to=1739000000000-pets-schema-and-sharing
  npm run migration:generate add-user-preferences
  npm run migration:validate

Environment Variables:
  DB_HOST             Database host (default: localhost)
  DB_PORT             Database port (default: 5432)
  DB_USERNAME         Database username (default: postgres)
  DB_PASSWORD         Database password (default: postgres)
  DB_DATABASE         Database name (default: petchain)
  DB_LOGGING          Enable query logging (default: false)
`);
  }
}
