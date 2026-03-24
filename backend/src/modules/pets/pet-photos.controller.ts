import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PetPhotosService } from './pet-photos.service';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import { PetPhoto } from './entities/pet-photo.entity';

@Controller('pets/:petId/photos')
export class PetPhotosController {
  constructor(private readonly petPhotosService: PetPhotosService) {}

  @Get()
  getPhotos(
    @Param('petId', ParseUUIDPipe) petId: string,
  ): Promise<PetPhoto[]> {
    return this.petPhotosService.getPhotos(petId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('photos', 10, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadPhotos(
    @Param('petId', ParseUUIDPipe) petId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<PetPhoto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one photo file is required');
    }
    return this.petPhotosService.uploadPhotos(petId, files);
  }

  @Patch(':photoId/primary')
  setPrimary(
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<PetPhoto> {
    return this.petPhotosService.setPrimary(petId, photoId);
  }

  @Put('reorder')
  reorderPhotos(
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() reorderDto: ReorderPhotosDto,
  ): Promise<PetPhoto[]> {
    return this.petPhotosService.reorderPhotos(petId, reorderDto.photoIds);
  }

  @Delete(':photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePhoto(
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<void> {
    return this.petPhotosService.deletePhoto(petId, photoId);
  }
}
