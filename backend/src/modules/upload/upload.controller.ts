import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UploadService } from './upload.service';
import { UploadFileDto } from './dto/upload-file.dto';
import {
  UploadResponseDto,
  FileResponseDto,
  FileListResponseDto,
  SignedUrlResponseDto,
} from './dto/file-response.dto';
import { FileType } from './entities/file-type.enum';
import { VariantType } from './entities/variant-type.enum';

/**
 * Upload Controller
 *
 * Handles file upload and management endpoints.
 */
@Controller('files')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Upload a single file
   *
   * @example POST /api/v1/files/upload
   * Content-Type: multipart/form-data
   * file: <binary>
   * petId: <uuid> (optional)
   * description: "My pet photo" (optional)
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB - also validated in service
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser('id') userId: string,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new Error('No file provided');
    }
    return this.uploadService.uploadFile(file, dto, userId);
  }

  /**
   * Get file metadata by ID
   *
   * @example GET /api/v1/files/:id
   */
  @Get(':id')
  async getFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FileResponseDto> {
    return this.uploadService.getFileById(id, userId);
  }

  /**
   * Get files for a specific pet
   *
   * @example GET /api/v1/files/pet/:petId
   */
  @Get('pet/:petId')
  async getFilesByPet(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser('id') userId: string,
  ): Promise<FileResponseDto[]> {
    return this.uploadService.getFilesByPet(petId, userId);
  }

  /**
   * Get all files for the current user
   *
   * @example GET /api/v1/files?page=1&pageSize=20&fileType=IMAGE
   */
  @Get()
  async getMyFiles(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('fileType') fileType?: FileType,
  ): Promise<FileListResponseDto> {
    const { files, total } = await this.uploadService.getFilesByOwner(userId, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      fileType,
    });

    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    return {
      files,
      total,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(total / pageSizeNum),
    };
  }

  /**
   * Get a signed download URL for a file
   *
   * @example GET /api/v1/files/:id/download?variant=THUMBNAIL
   */
  @Get(':id/download')
  async getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Query('variant') variant?: VariantType,
  ): Promise<SignedUrlResponseDto> {
    return this.uploadService.getDownloadUrl(id, userId, variant);
  }

  /**
   * Get all variants of a file
   *
   * @example GET /api/v1/files/:id/variants
   */
  @Get(':id/variants')
  async getFileVariants(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<FileResponseDto> {
    // This returns the full file response which includes variants
    return this.uploadService.getFileById(id, userId);
  }

  /**
   * Delete a file (soft delete)
   *
   * @example DELETE /api/v1/files/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.uploadService.deleteFile(id, userId);
  }
}
