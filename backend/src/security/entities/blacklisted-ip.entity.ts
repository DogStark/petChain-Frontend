import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('blacklisted_ips')
export class BlacklistedIp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  ipAddress: string;

  @Column()
  reason: string;

  @Column({ type: 'int', default: 0 })
  threatScore: number;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ default: true })
  isPermanent: boolean;

  @CreateDateColumn()
  blacklistedAt: Date;
}
