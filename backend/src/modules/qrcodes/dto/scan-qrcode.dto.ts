import {
  IsString,
  IsOptional,
  IsNumber,
  IsLatitude,
  IsLongitude,
} from 'class-validator';

/**
 * DTO for recording a QR code scan
 * Note: qrCodeId is optional here because it's passed via URL parameter in the controller
 */
export class ScanQRCodeDto {
  @IsString()
  @IsOptional()
  qrCodeId?: string; // Optional because it comes from URL param

  @IsOptional()
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;
}
