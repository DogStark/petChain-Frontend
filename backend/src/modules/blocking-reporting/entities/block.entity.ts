import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('blocks')
@Unique(['blocker', 'blockedUser'])
@Index(['blocker'])
@Index(['blockedUser'])
export class Block {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  blocker: string;

  @Column({ type: 'uuid' })
  blockedUser: string;

  blockedUserEntity?: any;

  @CreateDateColumn()
  createdAt: Date;
}