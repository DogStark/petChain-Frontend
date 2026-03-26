// @ts-nocheck
import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FilePermissionService } from './services/file-permission.service';
import { FileBackupService } from './services/file-backup.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import {
  ShareFileDto,
  UpdateFilePermissionDto,
  GenerateShareLinkDto,
  FilePermissionResponseDto,
  ShareLinkResponseDto,
  AccessViaShareTokenDto,
} from './dto/file-permission.dto';
import {
  CreateBackupDto,
  RestoreFromBackupDto,
  FileBackupResponseDto,
  FileBackupListResponseDto,
} from './dto/file-backup.dto';

/**
 * Files Controller
 *
 * Handles file management including retrieval, deletion, permissions, and backups.
 */
@Controller('api/v1/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly filePermissionService: FilePermissionService,
    private readonly fileBackupService: FileBackupService,
  ) {}

  /**
   * Get file metadata by ID
   * @example GET /api/v1/files/:id
   */
  @Get(':id')
  async getFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    // Check access permission
    await this.filePermissionService.canAccessFile(id, userId);
    return this.filesService.getFile(id, userId);
  }

  /**
   * Get download URL with signed access
   * @example GET /api/v1/files/:id/download
   */
  @Get(':id/download')
  async getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.filePermissionService.canAccessFile(id, userId);
    return this.filesService.getDownloadUrl(id, userId);
  }

  /**
   * Get file versions/history
   * @example GET /api/v1/files/:id/versions
   */
  @Get(':id/versions')
  async getVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.filePermissionService.canAccessFile(id, userId);
    return this.filesService.getVersions(id);
  }

  /**
   * Revert to a specific file version
   * @example POST /api/v1/files/:id/revert/:version
   */
  @Post(':id/revert/:version')
  async revertVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser('id') userId: string,
  ) {
    // Check EDITOR permission
    const canEdit = await this.filePermissionService.canPerformAction(
      id,
      userId,
    );
    if (!canEdit) {
      throw new Error('Insufficient permissions');
    }
    return this.filesService.revertVersion(id, version, userId);
  }

  /**
   * Delete a file (soft delete)
   * @example DELETE /api/v1/files/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    // Check OWNER permission
    const canDelete = await this.filePermissionService.canPerformAction(
      id,
      userId,
    );
    if (!canDelete) {
      throw new Error('Insufficient permissions');
    }
    await this.filesService.deleteFile(id, userId);
  }

  /**
   * Get files for a pet
   * @example GET /api/v1/files/pet/:petId
   */
  @Get('pet/:petId')
  async getByPet(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.filesService.getFilesByPet(petId, userId);
  }

  // ============= FILE PERMISSIONS / SHARING =============

  /**
   * Get all permissions for a file
   * @example GET /api/v1/files/:id/permissions
   */
  @Get(':id/permissions')
  async getFilePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FilePermissionResponseDto[]> {
    return this.filePermissionService.getFilePermissions(id, userId);
  }

  /**
   * Share file with a user
   * @example POST /api/v1/files/:id/share
   */
  @Post(':id/share')
  async shareFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareFileDto,
    @CurrentUser('id') userId: string,
  ): Promise<FilePermissionResponseDto> {
    return this.filePermissionService.shareFile(id, userId, dto);
  }

  /**
   * Generate a shareable link for a file
   * @example POST /api/v1/files/:id/share-link
   */
  @Post(':id/share-link')
  async generateShareLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateShareLinkDto,
    @CurrentUser('id') userId: string,
  ): Promise<ShareLinkResponseDto> {
    return this.filePermissionService.generateShareLink(id, userId, dto);
  }

  /**
   * Update a permission
   * @example PATCH /api/v1/files/:id/permissions/:permissionId
   */
  @Patch(':id/permissions/:permissionId')
  async updatePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @Body() dto: UpdateFilePermissionDto,
    @CurrentUser('id') userId: string,
  ): Promise<FilePermissionResponseDto> {
    return this.filePermissionService.updatePermission(id, permissionId, userId, dto);
  }

  /**
   * Revoke a permission
   * @example DELETE /api/v1/files/:id/permissions/:permissionId
   */
  @Delete(':id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.filePermissionService.revokePermission(id, permissionId, userId);
  }

  /**
   * Get files shared with current user
   * @example GET /api/v1/files/shared/with-me?page=1&pageSize=20
   */
  @Get('shared/with-me')
  async getFilesSharedWithMe(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 20,
    @CurrentUser('id') userId: string,
  ) {
    return this.filePermissionService.getFilesSharedWithMe(userId, page, pageSize);
  }

  // ============= FILE BACKUP & RECOVERY =============

  /**
   * Create a backup of a file
   * @example POST /api/v1/files/:id/backup
   */
  @Post(':id/backup')
  async createBackup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FileBackupResponseDto> {
    return this.fileBackupService.createBackup(id, userId, 'MANUAL');
  }

  /**
   * Get a specific backup
   * @example GET /api/v1/files/:id/backups/:backupId
   */
  @Get(':id/backups/:backupId')
  async getBackup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('backupId', ParseUUIDPipe) backupId: string,
    @CurrentUser('id') userId: string,
  ): Promise<FileBackupResponseDto> {
    return this.fileBackupService.getBackup(backupId, userId);
  }

  /**
   * Get all backups for a file
   * @example GET /api/v1/files/:id/backups?page=1&pageSize=20
   */
  @Get(':id/backups')
  async getFileBackups(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize: number = 20,
    @CurrentUser('id') userId: string,
  ): Promise<FileBackupListResponseDto> {
    return this.fileBackupService.getFileBackups(id, userId, page, pageSize);
  }

  /**
   * Restore from a backup
   * @example POST /api/v1/files/backups/:backupId/restore
   */
  @Post('backups/:backupId/restore')
  async restoreFromBackup(
    @Param('backupId', ParseUUIDPipe) backupId: string,
    @Body() dto: RestoreFromBackupDto,
    @CurrentUser('id') userId: string,
  ): Promise<FileBackupResponseDto> {
    return this.fileBackupService.restoreFromBackup(backupId, userId, dto.replaceOriginal);
  }

  /**
   * Delete a backup
   * @example DELETE /api/v1/files/backups/:backupId
   */
  @Delete('backups/:backupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBackup(
    @Param('backupId', ParseUUIDPipe) backupId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.fileBackupService.deleteBackup(backupId, userId);
  }
}
