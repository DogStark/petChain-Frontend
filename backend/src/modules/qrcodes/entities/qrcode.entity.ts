import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { QRCodeScan } from './qrcode-scan.entity';

@Entity('qrcodes')
export class QRCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @Column({ unique: true })
  qrCodeId: string; // Unique identifier for the QR code

  @Column('text')
  encryptedData: string; // Encrypted QR code payload

  @Column('text', { nullable: true })
  emergencyContact: string;

  @Column('text', { nullable: true })
  customMessage: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  scanCount: number;

  @OneToMany(() => QRCodeScan, (scan) => scan.qrcode)
  scans: QRCodeScan[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
