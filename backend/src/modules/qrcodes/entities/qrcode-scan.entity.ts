import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QRCode } from './qrcode.entity';

@Entity('qrcode_scans')
export class QRCodeScan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  qrcodeId: string;

  @ManyToOne(() => QRCode, (qrcode) => qrcode.scans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'qrcodeId' })
  qrcode: QRCode;

  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ nullable: true })
  deviceType: string; // mobile, tablet, desktop

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  country: string;

  @CreateDateColumn()
  scannedAt: Date;
}
