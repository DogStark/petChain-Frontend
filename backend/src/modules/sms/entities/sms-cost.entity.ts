import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sms_costs')
export class SmsCost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  userId: string | null;

  @Column()
  @Index()
  month: number;

  @Column()
  @Index()
  year: number;

  @Column({ default: 0 })
  totalSent: number;

  @Column({ default: 0 })
  totalDelivered: number;

  @Column({ default: 0 })
  totalFailed: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  totalCostCents: string;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  spendingLimitCents: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
