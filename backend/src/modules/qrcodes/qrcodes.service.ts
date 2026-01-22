import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QRCode } from './entities/qrcode.entity';
import { QRCodeScan } from './entities/qrcode-scan.entity';
import { CreateQRCodeDto, BatchCreateQRCodeDto } from './dto/create-qrcode.dto';
import { UpdateQRCodeDto } from './dto/update-qrcode.dto';
import { ScanQRCodeDto } from './dto/scan-qrcode.dto';
import { randomBytes } from 'crypto';
import * as QRCodeLib from 'qrcode';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class QRCodesService {
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(QRCode)
    private qrcodeRepository: Repository<QRCode>,
    @InjectRepository(QRCodeScan)
    private scanRepository: Repository<QRCodeScan>,
  ) {
    // In production, use environment variable for encryption key
    this.encryptionKey = process.env.QR_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
  }

  /**
   * Generate a unique QR code ID
   */
  private generateQRCodeId(): string {
    return `QR-${randomBytes(16).toString('hex').toUpperCase()}`;
  }

  /**
   * Encrypt QR code data
   */
  private encryptData(data: string): string {
    return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
  }

  /**
   * Decrypt QR code data
   */
  private decryptData(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Create QR code payload
   */
  private createQRCodePayload(qrcode: QRCode): string {
    const payload = {
      qrCodeId: qrcode.qrCodeId,
      petId: qrcode.petId,
      emergencyContact: qrcode.emergencyContact,
      customMessage: qrcode.customMessage,
      expiresAt: qrcode.expiresAt?.toISOString(),
    };
    return JSON.stringify(payload);
  }

  /**
   * Create a new QR code
   */
  async create(createQRCodeDto: CreateQRCodeDto): Promise<QRCode> {
    const qrCodeId = this.generateQRCodeId();
    
    const qrcode = this.qrcodeRepository.create({
      ...createQRCodeDto,
      qrCodeId,
      expiresAt: createQRCodeDto.expiresAt ? new Date(createQRCodeDto.expiresAt) : undefined,
    });

    // Encrypt the payload
    const payload = this.createQRCodePayload(qrcode);
    qrcode.encryptedData = this.encryptData(payload);

    return await this.qrcodeRepository.save(qrcode);
  }

  /**
   * Create multiple QR codes in batch
   */
  async createBatch(batchDto: BatchCreateQRCodeDto): Promise<QRCode[]> {
    const qrcodes = batchDto.qrcodes.map((dto) => {
      const qrCodeId = this.generateQRCodeId();
      const qrcode = this.qrcodeRepository.create({
        ...dto,
        qrCodeId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      });
      const payload = this.createQRCodePayload(qrcode);
      qrcode.encryptedData = this.encryptData(payload);
      return qrcode;
    });

    return await this.qrcodeRepository.save(qrcodes);
  }

  /**
   * Generate QR code image as data URL or buffer
   * Supports PNG and PDF formats for print-ready output
   */
  async generateQRCodeImage(
    qrCodeId: string,
    format: 'png' | 'pdf' = 'png',
    options?: { width?: number; margin?: number },
  ): Promise<string | Buffer> {
    const qrcode = await this.findOne(qrCodeId);
    
    if (!qrcode) {
      throw new NotFoundException('QR code not found');
    }

    const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/scan/${qrcode.qrCodeId}`;
    const width = options?.width || 512;
    const margin = options?.margin || 1;

    if (format === 'pdf') {
      // Generate high-resolution PNG buffer
      const pngBuffer = await QRCodeLib.toBuffer(url, {
        errorCorrectionLevel: 'H',
        type: 'png',
        width: width * 2, // Higher resolution for print
        margin: margin,
      });
      return pngBuffer;
    }

    // PNG format - return as data URL for easy embedding
    return await QRCodeLib.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: margin,
      width: width,
    });
  }

  /**
   * Generate print-ready QR code image (high resolution)
   */
  async generatePrintReadyQRCode(
    qrCodeId: string,
    format: 'png' | 'pdf' = 'png',
  ): Promise<Buffer> {
    const qrcode = await this.findOne(qrCodeId);
    
    if (!qrcode) {
      throw new NotFoundException('QR code not found');
    }

    const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/scan/${qrcode.qrCodeId}`;

    // High resolution for printing (300 DPI equivalent)
    const printWidth = 2000;
    const margin = 4;

    const buffer = await QRCodeLib.toBuffer(url, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: printWidth,
      margin: margin,
    });

    return buffer;
  }

  /**
   * Regenerate QR code (creates new ID and encrypted data)
   */
  async regenerate(qrCodeId: string): Promise<QRCode> {
    const qrcode = await this.findOne(qrCodeId);
    
    if (!qrcode) {
      throw new NotFoundException('QR code not found');
    }

    // Generate new QR code ID
    qrcode.qrCodeId = this.generateQRCodeId();
    
    // Re-encrypt with new payload
    const payload = this.createQRCodePayload(qrcode);
    qrcode.encryptedData = this.encryptData(payload);
    qrcode.scanCount = 0; // Reset scan count

    return await this.qrcodeRepository.save(qrcode);
  }

  /**
   * Find QR code by ID
   */
  async findOne(qrCodeId: string): Promise<QRCode> {
    const qrcode = await this.qrcodeRepository.findOne({
      where: { qrCodeId },
      relations: ['scans'],
    });

    if (!qrcode) {
      throw new NotFoundException('QR code not found');
    }

    return qrcode;
  }

  /**
   * Find QR code by pet ID
   */
  async findByPetId(petId: string): Promise<QRCode[]> {
    return await this.qrcodeRepository.find({
      where: { petId },
      relations: ['scans'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all QR codes
   */
  async findAll(): Promise<QRCode[]> {
    return await this.qrcodeRepository.find({
      relations: ['scans'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update QR code
   */
  async update(qrCodeId: string, updateQRCodeDto: UpdateQRCodeDto): Promise<QRCode> {
    const qrcode = await this.findOne(qrCodeId);

    Object.assign(qrcode, {
      ...updateQRCodeDto,
      expiresAt: updateQRCodeDto.expiresAt ? new Date(updateQRCodeDto.expiresAt) : qrcode.expiresAt,
    });

    // Re-encrypt if data changed
    if (updateQRCodeDto.emergencyContact || updateQRCodeDto.customMessage) {
      const payload = this.createQRCodePayload(qrcode);
      qrcode.encryptedData = this.encryptData(payload);
    }

    return await this.qrcodeRepository.save(qrcode);
  }

  /**
   * Record a QR code scan
   * Validates QR code is active and not expired before recording
   */
  async recordScan(scanDto: ScanQRCodeDto): Promise<{ qrcode: QRCode; scan: QRCodeScan }> {
    if (!scanDto.qrCodeId) {
      throw new BadRequestException('QR code ID is required');
    }

    const qrcode = await this.findOne(scanDto.qrCodeId);

    if (!qrcode.isActive) {
      throw new BadRequestException('QR code is not active');
    }

    if (qrcode.expiresAt && new Date() > qrcode.expiresAt) {
      throw new BadRequestException('QR code has expired');
    }

    // Create scan record (exclude qrCodeId from scan entity)
    const { qrCodeId, ...scanData } = scanDto;
    const scan = this.scanRepository.create({
      qrcodeId: qrcode.id,
      ...scanData,
    });

    const savedScan = await this.scanRepository.save(scan);

    // Update scan count
    qrcode.scanCount += 1;
    await this.qrcodeRepository.save(qrcode);

    return { qrcode, scan: savedScan };
  }

  /**
   * Get scan analytics for a QR code
   */
  async getScanAnalytics(qrCodeId: string): Promise<{
    totalScans: number;
    scans: QRCodeScan[];
    scansByLocation: Array<{ city: string; country: string; count: number }>;
    scansByDevice: Array<{ deviceType: string; count: number }>;
    recentScans: QRCodeScan[];
  }> {
    const qrcode = await this.findOne(qrCodeId);
    
    const scans = await this.scanRepository.find({
      where: { qrcodeId: qrcode.id },
      order: { scannedAt: 'DESC' },
    });

    // Group by location
    const locationMap = new Map<string, { city: string; country: string; count: number }>();
    scans.forEach((scan) => {
      if (scan.city && scan.country) {
        const key = `${scan.city}-${scan.country}`;
        const existing = locationMap.get(key) || { city: scan.city, country: scan.country, count: 0 };
        existing.count += 1;
        locationMap.set(key, existing);
      }
    });

    // Group by device
    const deviceMap = new Map<string, number>();
    scans.forEach((scan) => {
      if (scan.deviceType) {
        deviceMap.set(scan.deviceType, (deviceMap.get(scan.deviceType) || 0) + 1);
      }
    });

    return {
      totalScans: scans.length,
      scans,
      scansByLocation: Array.from(locationMap.values()),
      scansByDevice: Array.from(deviceMap.entries()).map(([deviceType, count]) => ({
        deviceType,
        count,
      })),
      recentScans: scans.slice(0, 10),
    };
  }

  /**
   * Delete QR code
   */
  async remove(qrCodeId: string): Promise<void> {
    const qrcode = await this.findOne(qrCodeId);
    await this.qrcodeRepository.remove(qrcode);
  }

  /**
   * Decrypt and return QR code data (for display)
   * Returns data matching the QRCodeData interface
   */
  async getDecryptedData(qrCodeId: string): Promise<{
    qrCodeId: string;
    petId: string;
    emergencyContact?: string;
    customMessage?: string;
    expiresAt?: string;
  }> {
    const qrcode = await this.findOne(qrCodeId);
    const decrypted = this.decryptData(qrcode.encryptedData);
    const parsed = JSON.parse(decrypted);
    
    // Return in format matching QRCodeData interface
    return {
      qrCodeId: parsed.qrCodeId,
      petId: parsed.petId,
      emergencyContact: parsed.emergencyContact || qrcode.emergencyContact || '',
      customMessage: parsed.customMessage || qrcode.customMessage || '',
      expiresAt: parsed.expiresAt,
    };
  }
}
