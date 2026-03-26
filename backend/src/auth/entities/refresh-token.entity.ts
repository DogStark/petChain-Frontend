import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  token: string; // Hashed token

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  deviceFingerprint: string; // Hashed fingerprint

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ nullable: true })
  replacedBy: string; // UUID of the token that replaced this one (for rotation)

  @CreateDateColumn()
  createdAt: Date;
}
