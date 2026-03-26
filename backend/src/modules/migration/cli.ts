#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { MigrationCliService } from './migration-cli.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const migrationCli = app.get(MigrationCliService);
  
  const args = process.argv.slice(2);
  const [command, ...commandArgs] = args;

  if (!command) {
    console.error('❌ No command provided.');
    await migrationCli.runCommand('help', []);
    await app.close();
    process.exit(1);
  }

  try {
    await migrationCli.runCommand(command, commandArgs);
  } catch (error) {
    console.error('❌ Migration command failed:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap().catch(error => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
