import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RecordShare } from './record-share.entity';
import { User } from '../../users/entities/user.entity';

export enum AccessAction {
  VIEW = 'view',
  DOWNLOAD = 'download',
  EDIT = 'edit',
  EXPORT = 'export',
}

@Entity('record_share_access_logs')
@Index(['shareId'])
@Index(['accessedAt'])
@Index(['accessorUserId'])
export class RecordShareAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  shareId: string;

  @ManyToOne(() => RecordShare, (share) => share.accessLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shareId' })
  share: RecordShare;

  @Column({ type: 'uuid', nullable: true })
  accessorUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'accessorUserId' })
  accessorUser: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  accessorEmail: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({
    type: 'enum',
    enum: AccessAction,
    default: AccessAction.VIEW,
  })
  action: AccessAction;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  accessedAt: Date;
}
