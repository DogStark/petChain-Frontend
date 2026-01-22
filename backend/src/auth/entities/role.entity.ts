import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoleName } from '../constants/roles.enum';
import { PermissionEntity } from './permission.entity';
import { UserRole } from './user-role.entity';
import { RolePermission } from './role-permission.entity';
import { User } from '../../modules/users/entities/user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: RoleName, unique: true })
  name: RoleName;

  @Column()
  description: string;

  @Column({ nullable: true })
  parentRoleId: string;

  @ManyToOne(() => Role, (role) => role.childRoles, { nullable: true })
  @JoinColumn({ name: 'parentRoleId' })
  parentRole: Role;

  @OneToMany(() => Role, (role) => role.parentRole)
  childRoles: Role[];

  @Column({ default: false })
  isSystemRole: boolean;

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions: RolePermission[];

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles: UserRole[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
