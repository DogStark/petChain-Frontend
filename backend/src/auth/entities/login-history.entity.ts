import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';

@Entity('login_history')
@Index(['userId', 'createdAt'])
export class LoginHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  ipAddress: string;

  @Column()
  userAgent: string;

  @Column({ nullable: true })
  location: string | null;

  @Column({ default: false })
  success: boolean;

  @Column({ default: false })
  anomalyFlag: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
