import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('verification_audits')
export class VerificationAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  recordId: string;

  @Column({ nullable: true })
  userId: string;

  @Column()
  result: string;

  @Column({ type: 'timestamp' })
  verifiedAt: Date;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @CreateDateColumn()
  createdAt: Date;
}
