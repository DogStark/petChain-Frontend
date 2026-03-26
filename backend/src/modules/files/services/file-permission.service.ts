import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { FilePermission, PermissionType, AccessLevel } from '../entities/file-permission.entity';
import { FileMetadata } from '../../upload/entities/file-metadata.entity';
import { User } from '../../modules/users/entities/user.entity';
import {
  ShareFileDto,
  UpdateFilePermissionDto,
  GenerateShareLinkDto,
  FilePermissionResponseDto,
  ShareLinkResponseDto,
} from '../dto/file-permission.dto';

/**
 * File Permission Service
 *
 * Manages file access permissions, sharing, and access control.
 */
@Injectable()
export class FilePermissionService {
  private readonly logger = new Logger(FilePermissionService.name);

  constructor(
    @InjectRepository(FilePermission)
    private readonly permissionRepository: Repository<FilePermission>,
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepository: Repository<FileMetadata>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Check if a user has access to a file
   * @returns true if user has at least VIEWER permission, false otherwise
   */
  async canAccessFile(fileId: string, userId: string): Promise<boolean> {
    // First check if user is the owner
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      return false;
    }

    if (fileMetadata.ownerId === userId) {
      return true;
    }

    // Check explicit permissions
    const permission = await this.permissionRepository.findOne({
      where: {
        fileId,
        userId,
        isActive: true,
      },
    });

    if (!permission) {
      return false;
    }

    // Check if permission has expired
    if (permission.expiresAt && permission.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Check if a user can perform a specific action
   */
  async canPerformAction(
    fileId: string,
    userId: string,
    requiredPermission: PermissionType = PermissionType.VIEWER,
  ): Promise<boolean> {
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      return false;
    }

    // Owner can do anything
    if (fileMetadata.ownerId === userId) {
      return true;
    }

    const permission = await this.permissionRepository.findOne({
      where: {
        fileId,
        userId,
        isActive: true,
      },
    });

    if (!permission) {
      return false;
    }

    // Check permission hierarchy: OWNER > EDITOR > COMMENTER > VIEWER
    const permissionHierarchy = {
      [PermissionType.OWNER]: 4,
      [PermissionType.EDITOR]: 3,
      [PermissionType.COMMENTER]: 2,
      [PermissionType.VIEWER]: 1,
    };

    const userLevel = permissionHierarchy[permission.permissionType] || 0;
    const requiredLevel = permissionHierarchy[requiredPermission] || 0;

    if (userLevel < requiredLevel) {
      return false;
    }

    // Check if permission has expired
    if (permission.expiresAt && permission.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Get all permissions for a file
   */
  async getFilePermissions(
    fileId: string,
    userId: string,
  ): Promise<FilePermissionResponseDto[]> {
    // Check if requester is owner
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }

    if (fileMetadata.ownerId !== userId) {
      throw new ForbiddenException(
        'Only file owner can view permissions',
      );
    }

    const permissions = await this.permissionRepository.find({
      where: { fileId },
      relations: ['user'],
    });

    return permissions.map(p => this.mapPermissionToDto(p));
  }

  /**
   * Share file with a user
   */
  async shareFile(
    fileId: string,
    ownerId: string,
    dto: ShareFileDto,
  ): Promise<FilePermissionResponseDto> {
    // Verify ownership
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }

    if (fileMetadata.ownerId !== ownerId) {
      throw new ForbiddenException('Only file owner can share');
    }

    // Verify recipient exists if shared with user
    if (dto.userId) {
      const recipient = await this.userRepository.findOne({
        where: { id: dto.userId },
      });

      if (!recipient) {
        throw new NotFoundException(`User not found: ${dto.userId}`);
      }
    }

    // Check if permission already exists
    const existingPermission = await this.permissionRepository.findOne({
      where: {
        fileId,
        userId: dto.userId || null,
      },
    });

    if (existingPermission) {
      // Update existing permission
      existingPermission.permissionType = dto.permissionType;
      existingPermission.accessLevel = dto.accessLevel;
      existingPermission.expiresAt = dto.expiresAt || null;
      existingPermission.notes = dto.notes || null;
      existingPermission.isActive = true;
      await this.permissionRepository.save(existingPermission);

      this.logger.log(`Updated permission for file ${fileId}`);
      return this.mapPermissionToDto(existingPermission);
    }

    // Create new permission
    const permission = this.permissionRepository.create({
      fileId,
      userId: dto.userId || null,
      permissionType: dto.permissionType,
      accessLevel: dto.accessLevel,
      expiresAt: dto.expiresAt || null,
      sharedBy: ownerId,
      notes: dto.notes || null,
      isActive: true,
    });

    await this.permissionRepository.save(permission);
    this.logger.log(`Shared file ${fileId} with user ${dto.userId || 'public'}`);

    return this.mapPermissionToDto(permission);
  }

  /**
   * Generate a shareable link token
   */
  async generateShareLink(
    fileId: string,
    userId: string,
    dto: GenerateShareLinkDto,
  ): Promise<ShareLinkResponseDto> {
    // Verify ownership
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }

    if (fileMetadata.ownerId !== userId) {
      throw new ForbiddenException('Only file owner can generate share links');
    }

    // Generate unique token
    const shareToken = randomBytes(32).toString('hex');

    // Create LINK access permission
    const permission = this.permissionRepository.create({
      fileId,
      userId: null,
      permissionType: dto.permissionType,
      accessLevel: AccessLevel.LINK,
      shareToken,
      expiresAt: dto.expiresAt || null,
      sharedBy: userId,
      isActive: true,
    });

    await this.permissionRepository.save(permission);
    this.logger.log(`Generated share link for file ${fileId}`);

    const shareUrl = `${process.env.API_URL || 'http://localhost:3001'}/files/access/${shareToken}`;

    return {
      shareToken,
      fileId,
      permissionType: dto.permissionType,
      expiresAt: dto.expiresAt || null,
      createdAt: permission.createdAt,
      shareUrl,
    };
  }

  /**
   * Revoke permission for a user
   */
  async revokePermission(
    fileId: string,
    permissionId: string,
    userId: string,
  ): Promise<void> {
    // Verify ownership
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }

    if (fileMetadata.ownerId !== userId) {
      throw new ForbiddenException('Only file owner can revoke permissions');
    }

    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId, fileId },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found: ${permissionId}`);
    }

    permission.isActive = false;
    await this.permissionRepository.save(permission);
    this.logger.log(`Revoked permission ${permissionId}`);
  }

  /**
   * Update a permission
   */
  async updatePermission(
    fileId: string,
    permissionId: string,
    userId: string,
    dto: UpdateFilePermissionDto,
  ): Promise<FilePermissionResponseDto> {
    // Verify ownership
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }

    if (fileMetadata.ownerId !== userId) {
      throw new ForbiddenException('Only file owner can update permissions');
    }

    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId, fileId },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found: ${permissionId}`);
    }

    // Update fields
    if (dto.permissionType) permission.permissionType = dto.permissionType;
    if (dto.accessLevel) permission.accessLevel = dto.accessLevel;
    if (dto.expiresAt !== undefined) permission.expiresAt = dto.expiresAt;
    if (dto.isActive !== undefined) permission.isActive = dto.isActive;
    if (dto.notes !== undefined) permission.notes = dto.notes;

    await this.permissionRepository.save(permission);
    this.logger.log(`Updated permission ${permissionId}`);

    return this.mapPermissionToDto(permission);
  }

  /**
   * Access file via share token
   */
  async accessViaShareToken(shareToken: string): Promise<{
    fileId: string;
    permissionType: PermissionType;
  }> {
    const permission = await this.permissionRepository.findOne({
      where: {
        shareToken,
        isActive: true,
        accessLevel: AccessLevel.LINK,
      },
    });

    if (!permission) {
      throw new ForbiddenException('Invalid or expired share link');
    }

    // Check expiration
    if (permission.expiresAt && permission.expiresAt < new Date()) {
      throw new ForbiddenException('Share link has expired');
    }

    // Update last accessed time
    permission.lastAccessedAt = new Date();
    await this.permissionRepository.save(permission);

    return {
      fileId: permission.fileId,
      permissionType: permission.permissionType,
    };
  }

  /**
   * Get files shared with a user
   */
  async getFilesSharedWithMe(userId: string, page: number = 1, pageSize: number = 20): Promise<{
    permissions: FilePermissionResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * pageSize;

    const [permissions, total] = await this.permissionRepository.findAndCount({
      where: {
        userId,
        isActive: true,
      },
      relations: ['file', 'user'],
      skip,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    return {
      permissions: permissions.map(p => this.mapPermissionToDto(p)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update last accessed time for tracking
   */
  async updateLastAccessed(permissionId: string): Promise<void> {
    await this.permissionRepository.update(
      { id: permissionId },
      { lastAccessedAt: new Date() },
    );
  }

  /**
   * Map permission entity to DTO
   */
  private mapPermissionToDto(permission: FilePermission): FilePermissionResponseDto {
    return {
      id: permission.id,
      fileId: permission.fileId,
      userId: permission.userId,
      userName: permission.user?.email,
      permissionType: permission.permissionType,
      accessLevel: permission.accessLevel,
      shareToken: permission.shareToken || undefined,
      sharedBy: permission.sharedBy,
      expiresAt: permission.expiresAt,
      isActive: permission.isActive,
      notes: permission.notes,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
      lastAccessedAt: permission.lastAccessedAt,
    };
  }

  /**
   * Clean up expired permissions (scheduled job)
   */
  async cleanupExpiredPermissions(): Promise<number> {
    const result = await this.permissionRepository.update(
      {
        expiresAt: new Date(),
        isActive: true,
      },
      { isActive: false },
    );

    const count = result.affected || 0;
    this.logger.log(`Cleaned up ${count} expired permissions`);
    return count;
  }
}
