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
import { User } from '../../users/entities/user.entity';

@Entity('pets')
@Index(['breed', 'age'])
@Index(['location'])
export class Pet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  breed: string;

  @Column()
  species: string; // Dog, Cat, Bird, etc.

  @Column('int')
  age: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ nullable: true })
  location: string; // City, State, Country

  @Column({ nullable: true })
  chipId: string; // Unique chip/tag identifier

  @Column({ nullable: true })
  qrCode: string; // QR code identifier

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'active' })
  status: string; // active, missing, deceased

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Additional searchable metadata

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
