import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { QRCodesService } from './qrcodes.service';
import { CreateQRCodeDto, BatchCreateQRCodeDto } from './dto/create-qrcode.dto';
import { UpdateQRCodeDto } from './dto/update-qrcode.dto';
import { ScanQRCodeDto } from './dto/scan-qrcode.dto';
import {
  QRCodeResponseDto,
  ScanAnalyticsResponseDto,
  ScanRecordResponseDto,
} from './dto/qrcode-response.dto';

@Controller('qrcodes')
export class QRCodesController {
  constructor(private readonly qrcodesService: QRCodesService) {}

  /**
   * Create a new QR code
   * POST /qrcodes
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createQRCodeDto: CreateQRCodeDto): Promise<QRCodeResponseDto> {
    const qrcode = await this.qrcodesService.create(createQRCodeDto);
    return QRCodeResponseDto.fromEntity(qrcode);
  }

  /**
   * Create multiple QR codes in batch
   * POST /qrcodes/batch
   */
  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(@Body() batchDto: BatchCreateQRCodeDto): Promise<QRCodeResponseDto[]> {
    const qrcodes = await this.qrcodesService.createBatch(batchDto);
    return qrcodes.map((qrcode) => QRCodeResponseDto.fromEntity(qrcode));
  }

  /**
   * Get all QR codes or filter by petId
   * GET /qrcodes?petId=xxx
   */
  @Get()
  async findAll(@Query('petId') petId?: string): Promise<QRCodeResponseDto[]> {
    const qrcodes = petId
      ? await this.qrcodesService.findByPetId(petId)
      : await this.qrcodesService.findAll();
    return qrcodes.map((qrcode) => QRCodeResponseDto.fromEntity(qrcode));
  }

  /**
   * Get a single QR code by ID
   * GET /qrcodes/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<QRCodeResponseDto> {
    const qrcode = await this.qrcodesService.findOne(id);
    return QRCodeResponseDto.fromEntity(qrcode);
  }

  /**
   * Get QR code image
   * GET /qrcodes/:id/image?format=png|pdf&width=512&printReady=true
   */
  @Get(':id/image')
  async getQRCodeImage(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('format') format: 'png' | 'pdf' = 'png',
    @Query('width') width?: string,
    @Query('printReady') printReady?: string,
  ) {
    try {
      const isPrintReady = printReady === 'true';
      const imageWidth = width ? parseInt(width, 10) : undefined;

      if (isPrintReady) {
        // Print-ready format
        const printFormat = format === 'pdf' ? 'png' : 'png';
        const buffer = await this.qrcodesService.generatePrintReadyQRCode(id, printFormat);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="qrcode-${id}-print.png"`);
        res.send(buffer);
      } else {
        const imageData = await this.qrcodesService.generateQRCodeImage(id, format, {
          width: imageWidth,
        });

        if (format === 'pdf' || Buffer.isBuffer(imageData)) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Disposition', `attachment; filename="qrcode-${id}.png"`);
          res.send(imageData);
        } else {
          // PNG as base64 data URL
          const base64Data = (imageData as string).replace(/^data:image\/png;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Disposition', `attachment; filename="qrcode-${id}.png"`);
          res.send(buffer);
        }
      }
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({ message: error.message });
    }
  }

  /**
   * Get decrypted QR code data
   * GET /qrcodes/:id/data
   */
  @Get(':id/data')
  async getDecryptedData(@Param('id') id: string) {
    return await this.qrcodesService.getDecryptedData(id);
  }

  /**
   * Get scan analytics for a QR code
   * GET /qrcodes/:id/analytics
   */
  @Get(':id/analytics')
  async getScanAnalytics(@Param('id') id: string): Promise<ScanAnalyticsResponseDto> {
    return await this.qrcodesService.getScanAnalytics(id);
  }

  /**
   * Regenerate QR code (creates new ID and invalidates old one)
   * POST /qrcodes/:id/regenerate
   */
  @Post(':id/regenerate')
  async regenerate(@Param('id') id: string): Promise<QRCodeResponseDto> {
    const qrcode = await this.qrcodesService.regenerate(id);
    return QRCodeResponseDto.fromEntity(qrcode);
  }

  /**
   * Record a QR code scan
   * POST /qrcodes/:id/scan
   */
  @Post(':id/scan')
  @HttpCode(HttpStatus.CREATED)
  async recordScan(
    @Param('id') id: string,
    @Body() scanDto: ScanQRCodeDto,
  ): Promise<ScanRecordResponseDto> {
    const result = await this.qrcodesService.recordScan({ ...scanDto, qrCodeId: id });
    return {
      qrcode: QRCodeResponseDto.fromEntity(result.qrcode),
      scan: {
        id: result.scan.id,
        latitude: result.scan.latitude,
        longitude: result.scan.longitude,
        deviceType: result.scan.deviceType,
        city: result.scan.city,
        country: result.scan.country,
        scannedAt: result.scan.scannedAt,
      },
    };
  }

  /**
   * Update QR code
   * PATCH /qrcodes/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateQRCodeDto: UpdateQRCodeDto,
  ): Promise<QRCodeResponseDto> {
    const qrcode = await this.qrcodesService.update(id, updateQRCodeDto);
    return QRCodeResponseDto.fromEntity(qrcode);
  }

  /**
   * Delete QR code
   * DELETE /qrcodes/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return await this.qrcodesService.remove(id);
  }
}
