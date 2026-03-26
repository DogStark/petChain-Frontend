import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('blocks')
@Index(['blocker', 'blockedUser'], { unique: true })
@Index(['blocker'])
@Index(['blockedUser'])
export class Block {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  blocker: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'blocker' })
  blockerUser: User;

  @Column()
  blockedUser: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'blockedUser' })
  blockedUserEntity: User;

  @CreateDateColumn()
  createdAt: Date;
}
