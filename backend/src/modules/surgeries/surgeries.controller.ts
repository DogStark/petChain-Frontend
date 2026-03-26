import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SurgeriesService } from './surgeries.service';
import { CreateSurgeryDto } from './dto/create-surgery.dto';
import { UpdateSurgeryDto } from './dto/update-surgery.dto';
import { SurgeryStatus } from './entities/surgery.entity';

@Controller('surgeries')
export class SurgeriesController {
  constructor(private readonly surgeriesService: SurgeriesService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('photos', 10))
  async create(
    @Body() createSurgeryDto: CreateSurgeryDto,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    if (photos && photos.length > 0) {
      const photoUrls = await Promise.all(
        photos.map((photo) => this.surgeriesService.savePhoto(photo)),
      );
      createSurgeryDto.photos = photoUrls;
    }

    return this.surgeriesService.create(createSurgeryDto);
  }

  @Get()
  findAll(
    @Query('petId') petId?: string,
    @Query('status') status?: SurgeryStatus,
  ) {
    return this.surgeriesService.findAll(petId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.surgeriesService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FilesInterceptor('photos', 10))
  async update(
    @Param('id') id: string,
    @Body() updateSurgeryDto: UpdateSurgeryDto,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    if (photos && photos.length > 0) {
      const photoUrls = await Promise.all(
        photos.map((photo) => this.surgeriesService.savePhoto(photo)),
      );
      updateSurgeryDto.photos = [...(updateSurgeryDto.photos || []), ...photoUrls];
    }

    return this.surgeriesService.update(id, updateSurgeryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.surgeriesService.remove(id);
  }
}
