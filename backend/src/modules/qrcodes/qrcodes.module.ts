import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QRCodesService } from './qrcodes.service';
import { QRCodesController } from './qrcodes.controller';
import { QRCode } from './entities/qrcode.entity';
import { QRCodeScan } from './entities/qrcode-scan.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QRCode, QRCodeScan])],
  controllers: [QRCodesController],
  providers: [QRCodesService],
  exports: [QRCodesService],
})
export class QRCodesModule {}
