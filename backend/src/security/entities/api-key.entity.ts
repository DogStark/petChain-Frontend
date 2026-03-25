import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  keyHash: string; // SHA-256 hash of the actual key

  @Column()
  name: string; // Human-readable label

  @Column({ nullable: true })
  ownerId: string; // User or service that owns this key

  @Column({ type: 'simple-array', nullable: true })
  scopes: string[]; // e.g. ['read:pets', 'write:records']

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ default: 0 })
  requestCount: number;

  @Column({ nullable: true })
  lastUsedAt: Date;

  @Column({ nullable: true })
  ipWhitelist: string; // comma-separated IPs

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
