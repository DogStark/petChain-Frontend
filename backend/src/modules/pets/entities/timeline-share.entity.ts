import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pet } from './pet.entity';

/**
 * Entity for storing timeline share links
 * Allows pet owners to share their pet's medical history timeline
 */
@Entity('timeline_shares')
export class TimelineShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pet_id' })
  @Index()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({ name: 'share_token', unique: true })
  @Index()
  shareToken: string;

  @Column({ name: 'owner_id' })
  @Index()
  ownerId: string;

  @Column({ name: 'recipient_email', nullable: true })
  recipientEmail: string | null;

  @Column({ name: 'event_type_filter', default: 'all' })
  eventTypeFilter: string;

  @Column({ name: 'start_date_filter', type: 'timestamp', nullable: true })
  startDateFilter: Date | null;

  @Column({ name: 'end_date_filter', type: 'timestamp', nullable: true })
  endDateFilter: Date | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'expires_at', type: 'timestamp' })
  @Index()
  expiresAt: Date;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @Column({ name: 'access_count', default: 0 })
  accessCount: number;

  @Column({ name: 'last_accessed_at', type: 'timestamp', nullable: true })
  lastAccessedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Check if the share is currently valid
   */
  isValid(): boolean {
    return !this.isRevoked && new Date() < this.expiresAt;
  }
}
