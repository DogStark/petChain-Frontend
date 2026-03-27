import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { FilesController } from './files.controller';
import { AdminFilesController } from './controllers/admin-files.controller';
import { FilesService } from './files.service';
import { FileMetadata } from '../upload/entities/file-metadata.entity';
import { FileVariant } from '../upload/entities/file-variant.entity';
import { FileVersion } from '../upload/entities/file-version.entity';
import { FilePermission } from './entities/file-permission.entity';
import { FileBackup } from './entities/file-backup.entity';
import { CdnModule } from '../cdn/cdn.module';
import { StorageModule } from '../storage/storage.module';
import { FilePermissionService } from './services/file-permission.service';
import { FileBackupService } from './services/file-backup.service';
import { FileBackupProcessor } from './processors/file-backup.processor';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FileMetadata,
      FileVariant,
      FileVersion,
      FilePermission,
      FileBackup,
      User,
    ]),
    CdnModule,
    StorageModule,
    BullModule.registerQueue({ name: 'file-backup' }),
  ],
  controllers: [FilesController, AdminFilesController],
  providers: [
    FilesService,
    FilePermissionService,
    FileBackupService,
    FileBackupProcessor,
  ],
  exports: [FilesService, FilePermissionService, FileBackupService],
})
export class FilesModule {}
