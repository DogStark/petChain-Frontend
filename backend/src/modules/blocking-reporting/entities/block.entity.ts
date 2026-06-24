import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('blocks')
@Unique(['blockerId', 'blockedId'])
@Index(['blockerId'])
@Index(['blockedId'])
export class Block {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  blockerId: string;

  @Column({ type: 'uuid' })
  blockedId: string;

  @CreateDateColumn()
  createdAt: Date;
}