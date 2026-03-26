import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VetVerificationService } from './vet-verification.service';
import { VerificationStatus } from './vet-verification.entity';

@Controller('vet-verification')
export class VetVerificationController {
  constructor(
    private readonly vetService: VetVerificationService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('licenseNumber') licenseNumber: string,
  ) {
    const record = await this.vetService.create({
      licenseNumber,
      documentUrl: file?.filename || 'mock-file',
    });

    return this.vetService.autoVerify(record);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.vetService.getStatus(id);
  }

  @Post('review')
  review(
    @Body('id') id: string,
    @Body('status') status: VerificationStatus,
  ) {
    return this.vetService.manualReview(id, status);
  }
}