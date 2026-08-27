import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ConsentType {
  MARKETING = 'marketing',
  ANALYTICS = 'analytics',
  DATA_SHARING = 'data_sharing',
  ESSENTIAL = 'essential',
}

@Entity('user_consents')
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: ConsentType })
  type: ConsentType;

  @Column({ default: false })
  granted: boolean;

  @Column({ type: 'inet', nullable: true, name: 'ip_address' })
  ipAddress: string | null;

  @Column({ nullable: true, name: 'user_agent' })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
