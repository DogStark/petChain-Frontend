import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Role } from './role.entity';

export enum RoleAuditAction {
  ASSIGNED = 'ASSIGNED',
  REMOVED = 'REMOVED',
  UPDATED = 'UPDATED',
}

@Entity('role_audit_logs')
export class RoleAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ type: 'enum', enum: RoleAuditAction })
  action: RoleAuditAction;

  @Column()
  performedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performedBy' })
  performer: User;

  @Column({ nullable: true })
  reason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
