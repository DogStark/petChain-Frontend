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
import { FileMetadata } from '../../upload/entities/file-metadata.entity';
import { User } from '../../users/entities/user.entity';
import { Pet } from '../../pets/entities/pet.entity';

/**
 * File Permission Type
 * - OWNER: Full control, can share and delete
 * - EDITOR: Can read and update metadata
 * - VIEWER: Read-only access
 * - COMMENTER: Can read and add comments (for future use)
 */
export enum PermissionType {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  COMMENTER = 'commenter',
}

/**
 * File Sharing Access Type
 * - PRIVATE: Only owner and explicitly granted users
 * - LINK: Accessible via shareable link
 * - PUBLIC: Anyone can access
 */
export enum AccessLevel {
  PRIVATE = 'private',
  LINK = 'link',
  PUBLIC = 'public',
}

/**
 * File Permission Entity
 *
 * Manages access control for files. Allows:
 * - Sharing files with specific users
 * - Setting different permission levels
 * - Public/link sharing
 * - Audit trail of permissions
 *
 * Pet association is used to enforce pet-photo ownership on mutations.
 * When a file is associated with a pet, the petId must be set, and
 * authorization logic uses it to prevent cross-pet or cross-owner access.
 */
ENTITY('file_permissions')
@Index(['fileId', 'userId'])
@Index(['fileId', 'accessLevel'])
@Index(['sharedBy'])
@Index(['petId', 'fileId'])
export class FilePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * File this permission applies to
   */
  @Column()
  fileId: string;

  @ManyToOne(() => FileMetadata, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'fileId',
  })
  file: FileMetadata;

  /**
   * User receiving permission (null if public/link access)
   */
  @Column({ nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
  })
  user: User | null;

  /**
   * Pet associated with this file permission.
   * Used to scope permissions to a specific pet and enforce ownership.
   * Nullable for non-pet-related files (e.g., avatars).
   */
  @Column({ nullable: true })
  petId: string | null;

  @ManyToOne(() => Pet, { nullable: true, onDelete: 'CASCADE'" })
  @JoinColumn({
    name: 'petId',
  })
  pet: Pet | null;

  /**
   * Permission level for this user
   */
  @Column({
    type: 'enum',
    enum: PermissionType,
    default: PermissionType.VIEWER,
  })
  permissionType: PermissionType;

  /**
   * Access level for this file
   * Used to determine if file is private, link-accessible, or public
   */
  @Column({
    type: 'enum',
    enum: AccessLevel,
    default: AccessLevel.PRIVATE,
  })
  accessLevel: AccessLevel;

  /**
   * Shareable link token (for LINK access level)
   * Unique identifier to share without authentication
   */
  @Column({ nullable: true, unique: true })
  shareToken: string | null;

  /**
   * User who granted this permission
   */
  @Column()
  sharedBy: string;

  /**
   * Optional expiration date for the permission
   * After this date, access is revoked
   */
  @Column({ nullable: true })
  expiresAt: Date | null;

  /**
   * Whether this permission is currently active
   */
  @Column({ nullable: true, default: true })
  isActive: boolean;

  /**
   * Optional notes about why permission was granted
   */
  @Column({ nullable: true, length: 500 })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Track when access was last used
   */
  @Column({ nullable: true })
  lastAccessedAt: Date | null;
}