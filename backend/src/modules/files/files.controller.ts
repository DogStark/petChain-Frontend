import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesService } from './files.service';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // Assuming Auth exists

@Controller('api/v1/files')
// @UseGuards(JwtAuthGuard) // Enable in production
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':id')
  async getFile(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    // const userId = req.user?.id;
    return this.filesService.getFile(id, undefined); // userId undefined for now
  }

  @Get(':id/download')
  async getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    // const userId = req.user?.id;
    return this.filesService.getDownloadUrl(id, undefined);
  }

  @Get(':id/versions')
  async getVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.getVersions(id);
  }

  @Post(':id/revert/:version')
  async revertVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @Request() req: any,
  ) {
    const userId = 'system'; // TODO: Get from auth
    return this.filesService.revertVersion(id, version, userId);
  }

  @Delete(':id')
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const userId = 'system'; // TODO: Get from auth
    return this.filesService.deleteFile(id, userId);
  }

  @Get('pet/:petId')
  async getByPet(@Param('petId', ParseUUIDPipe) petId: string) {
    return this.filesService.getFilesByPet(petId);
  }
}
