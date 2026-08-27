// @ts-nocheck
import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { FilesService } from '../files.service';
import { FileBackupService } from '../services/file-backup.service';
import { BackupStatisticsDto } from '../dto/file-backup.dto';

/**
 * Admin Files Controller
 *
 * Administrative endpoints for file management across the system.
 * Requires ADMIN role.
 *
 * Provides:
 * - System-wide file auditing
 * - File statistics and reporting
 * - Backup management
 * - Storage usage tracking
 * - Compliance operations
 */
@Controller('api/v1/admin/files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminFilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly fileBackupService: FileBackupService,
  ) {}

  /**
   * Get system file statistics
   * @example GET /api/v1/admin/files/statistics
   */
  @Get('statistics')
  async getFileStatistics() {
    return this.filesService.getSystemStatistics();
  }

  /**
   * Get backup statistics
   * @example GET /api/v1/admin/files/backups/statistics
   */
  @Get('backups/statistics')
  async getBackupStatistics(): Promise<BackupStatisticsDto> {
    return this.fileBackupService.getBackupStatistics();
  }

  /**
   * List all files in the system (paginated)
   * @example GET /api/v1/admin/files/all?page=1&pageSize=50&status=ACTIVE
   */
  @Get('all')
  async getAllFiles(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true }))
    pageSize: number = 50,
    @Query('status') status?: string,
    @Query('fileType') fileType?: string,
    @Query('userId', new ParseUUIDPipe({ optional: true })) userId?: string,
  ) {
    return this.filesService.getSystemFiles({
      page,
      pageSize,
      status,
      fileType,
      userId,
    });
  }

  /**
   * Get storage usage by user
   * @example GET /api/v1/admin/files/storage/by-user
   */
  @Get('storage/by-user')
  async getStorageByUser() {
    return this.filesService.getStorageUsageByUser();
  }

  /**
   * Get storage usage by file type
   * @example GET /api/v1/admin/files/storage/by-type
   */
  @Get('storage/by-type')
  async getStorageByType() {
    return this.filesService.getStorageUsageByType();
  }

  /**
   * Get file audit log
   * @example GET /api/v1/admin/files/:id/audit
   */
  @Get(':id/audit')
  async getFileAuditLog(
    @Param('id', ParseUUIDPipe) fileId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true }))
    pageSize: number = 50,
  ) {
    return this.filesService.getFileAuditLog(fileId, page, pageSize);
  }

  /**
   * Permanently delete a file (admin override)
   * @example DELETE /api/v1/admin/files/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async permanentlyDeleteFile(
    @Param('id', ParseUUIDPipe) fileId: string,
  ): Promise<void> {
    return this.filesService.permanentlyDeleteFile(fileId);
  }

  /**
   * Clean up orphaned backups
   * @example POST /api/v1/admin/files/backups/cleanup
   */
  @Get('backups/cleanup')
  async cleanupOrphanedBackups() {
    const count = await this.fileBackupService.cleanupExpiredBackups();
    return {
      message: `Cleaned up ${count} expired backups`,
      count,
    };
  }

  /**
   * Get files pending deletion
   * @example GET /api/v1/admin/files/deleted/pending
   */
  @Get('deleted/pending')
  async getPendingDeletions(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true }))
    pageSize: number = 50,
  ) {
    return this.filesService.getPendingDeletions(page, pageSize);
  }

  /**
   * Restore a deleted file (admin recovery)
   * @example POST /api/v1/admin/files/:id/restore
   */
  @Get(':id/restore')
  async restoreDeletedFile(@Param('id', ParseUUIDPipe) fileId: string) {
    return this.filesService.restoreDeletedFile(fileId);
  }
}
