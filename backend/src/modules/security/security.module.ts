import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VirusScannerService } from './virus-scanner.service';
import { EncryptionService } from './encryption.service';
import { VIRUS_SCANNER } from './interfaces/virus-scanner.interface';

/**
 * Security Module
 *
 * Provides security services across the application.
 *
 * Features:
 * - Virus scanning (ClamAV integration with fallback)
 * - File encryption at rest (AES-256-GCM)
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    VirusScannerService,
    EncryptionService,
    {
      provide: VIRUS_SCANNER,
      useExisting: VirusScannerService,
    },
  ],
  exports: [VirusScannerService, EncryptionService, VIRUS_SCANNER],
})
export class SecurityModule {}
