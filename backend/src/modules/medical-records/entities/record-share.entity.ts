import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { MedicalRecord } from './medical-record.entity';
import { User } from '../../users/entities/user.entity';
import { RecordShareAccess } from './record-share-access.entity';

export enum SharePermission {
  VIEW = 'view',
  EDIT = 'edit',
}

@Entity('record_shares')
@Index(['token'], { unique: true })
@Index(['medicalRecordId'])
@Index(['createdById'])
@Index(['recipientEmail'])
export class RecordShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  token: string;

  @Column({ type: 'uuid' })
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medicalRecordId' })
  medicalRecord: MedicalRecord;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipientEmail: string;

  @Column({ type: 'uuid', nullable: true })
  recipientUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recipientUserId' })
  recipientUser: User;

  @Column({
    type: 'enum',
    enum: SharePermission,
    default: SharePermission.VIEW,
  })
  permission: SharePermission;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'int', default: 0 })
  accessCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastAccessedAt: Date;

  @OneToMany(() => RecordShareAccess, (access) => access.share)
  accessLogs: RecordShareAccess[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  canEdit(): boolean {
    return this.permission === SharePermission.EDIT && this.isValid();
  }
}
