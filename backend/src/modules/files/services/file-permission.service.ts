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
import {
  FilePermission,
  PermissionType,
  AccessLevel,
} from '../entities/file-permission.entity';
import { FileMetadata } from '../../upload/entities/file-metadata.entity';
import { User } from '../../users/entities/user.entity';
import {
  ShareFileDto,
  UpdateFilePermissionDto,
  GenerateShareLinkDto,
  FilePermissionResponseDto,
  ShareLinkResponseDto,
} from '../dto/file-permission.dto';

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

  async canAccessFile(fileId: string, userId: string): Promise<boolean> {
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      return false;
    }

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

    if (permission.expiresAt && permission.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

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

    if (permission.expiresAt && permission.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  async getFilePermissions(
    fileId: string,
    userId: string,
  ): Promise<FilePermissionResponseDto[]> {
    await this.ensureFilePetOwnership(fileId, userId);

    const permissions = await this.permissionRepository.find({
      where: { fileId },
      relations: ['user'],
    });

    return permissions.map((p) => this.mapPermissionToDto(p));
  }

  async shareFile(
    fileId: string,
    ownerId: string,
    dto: ShareFileDto,
    petId?: string,
  ): Promise<FilePermissionResponseDto> {
    await this.ensureFilePetOwnership(fileId, ownerId, petId);

    if (dto.userId) {
      const recipient = await this.userRepository.findOne({
        where: { id: dto.userId },
      });

      if (!recipient) {
        throw new NotFoundException(`User not found: ${dto.userId}`);
      }
    }

    const existingPermission = await this.permissionRepository.findOne({
      where: {
        fileId,
        userId: dto.userId || null,
      },
    });

    if (existingPermission) {
      existingPermission.permissionType = dto.permissionType;
      existingPermission.accessLevel = dto.accessLevel;
      existingPermission.expiresAt = dto.expiresAt || null;
      existingPermission.notes = dto.notes || null;
      existingPermission.isActive = true;
      await this.permissionRepository.save(existingPermission);

      this.logger.log(`Updated permission for file ${fileId}`);
      return this.mapPermissionToDto(existingPermission);
    }

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

  async generateShareLink(
    fileId: string,
    userId: string,
    dto: GenerateShareLinkDto,
    petId?: string,
  ): Promise<ShareLinkResponseDto> {
    await this.ensureFilePetOwnership(fileId, userId, petId);

    const shareToken = random.bytes(32).toString('hex');

    const permission = this.permissionRepository.create({
      fileId,
      userId: null,
      permissionType: dto.permissionType,
      accessLevel: AccessLevel.LInk,
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

  async revokePermission(
    fileId: string,
    permissionId: string,
    userId: string,
    petId?: string,
  ): Promise<void> {
    await this.ensureFilePetOwnership(fileId, userId, petId);

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

  async updatePermission(
    fileId: string,
    permissionId: string,
    userId: string,
    dto: UpdateFilePermissionDto,
    petId?: string,
  ): Promise<FilePermissionResponseDto> {
    await this.ensureFilePetOwnership(fileId, userId, petId);

    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId, fileId },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found: ${permissionId}`);
    }

    if (dto.permissionType) permission.permissionType = dto.permissionType;
    if (dto.accessLevel) permission.accessLevel = dto.accessLevel;
    if (dto.expiresAt !== undefined) permission.expiresAt = dto.expiresAt;
    if (dto.isActive !== undefined) permission.isActive = dto.isActive;
    if (dto.notes !== undefined) permission.notes = dto.notes;

    await this.permissionRepository.save(permission);
    this.logger.log(`Updated permission ${permissionId}`);

    return this.mapPermissionToDto(permission);
  }

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

    if (permission.expiresAt && permission.expiresAt < new Date()) {
      throw new ForbiddenException('Share link has expired');
    }

    permission.lastAccessedAt = new Date();
    await this.permissionRepository.save(permission);

    return {
      fileId: permission.fileId,
      permissionType: permission.permissionType,
    };
  }

  async getFilesSharedWithMe(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{
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
      permissions: permissions.map((p) => this.mapPermissionToDto(p)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateLastAccessed(permissionId: string): Promise<void> {
    await this.permissionRepository.update(
      { id: permissionId },
      { lastAccessedAt: new Date() },
    );
  }

  private async ensureFilePetOwnership(
    fileId: string,
    userId: string,
    petId?: string,
  ): Promise<FileMetadata> {
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }

    if (fileMetadata.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to this file');
    }

    if (petId) {
      if (!fileMetadata.petId) {
        throw new BadRequestException('File is not associated with a pet');
      }
      if (fileMetadata.petId !== petId) {
        throw new ForbiddenException('File does not belong to the specified pet');
      }
    }

    return fileMetadata;
  }

  private mapPermissionToDto(
    permission: FilePermission,
  ): FilePermissionResponseDto {
    return {
      id: permission.id,
      fileId: permission.fileId,
      userId: permission.userId,
      userName: permission.user?.email,
      permissionType: permission.permissionType,
      accessLevel: permission.accessLevel,
      shareToken: permission.shareToken,
      expiresAt: permission.expiresAt,
      createdAt: permission.createdAt,
      isActive: permission.isActive,
    };
  }
}