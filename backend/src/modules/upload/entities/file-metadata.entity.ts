import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Pet } from '../../pets/entities/pet.entity';
import { FileType } from './file-type.enum';
import { FileStatus } from './file-status.enum';
import { FileVersion } from './file-version.entity';
import { FileVariant } from './file-variant.entity';

/**
 * File Metadata Entity
 *
 * Stores metadata about uploaded files including ownership,
 * storage location, processing status, and security information.
 */
@Entity('file_metadata')
@Index(['ownerId', 'status'])
@Index(['petId'])
@Index(['status'])
@Index(['createdAt'])
export class FileMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Owner of the file (user who uploaded it)
   */
  @Column({ nullable: true })
  ownerId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  /**
   * Pet associated with this file (if applicable)
   */
  @Column({ nullable: true })
  petId: string;

  @ManyToOne(() => Pet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  /**
   * Original filename as uploaded by user
   */
  @Column()
  originalFilename: string;

  /**
   * Storage key in the cloud provider
   */
  @Column()
  @Index()
  storageKey: string;

  /**
   * MIME type of the file
   */
  @Column()
  mimeType: string;

  /**
   * General file type category
   */
  @Column({
    type: 'enum',
    enum: FileType,
  })
  fileType: FileType;

  /**
   * Current processing/lifecycle status
   */
  @Column({
    type: 'enum',
    enum: FileStatus,
    default: FileStatus.PENDING,
  })
  status: FileStatus;

  /**
   * File size in bytes
   */
  @Column({ type: 'bigint' })
  sizeBytes: number;

  /**
   * Whether the file is encrypted at rest
   */
  @Column({ default: false })
  isEncrypted: boolean;

  /**
   * Initialization vector for decryption (if encrypted)
   */
  @Column({ nullable: true })
  encryptionIv: string;

  /**
   * Current version number
   */
  @Column({ default: 1 })
  version: number;

  /**
   * File checksum for integrity verification (SHA-256)
   */
  @Column({ nullable: true })
  checksum: string;

  /**
   * Extended metadata (width, height, duration, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    width?: number;
    height?: number;
    duration?: number; // Video duration in seconds
    codec?: string;
    bitrate?: number;
    pages?: number; // For documents
    exifRemoved?: boolean;
    virusScanResult?: 'clean' | 'infected' | 'pending' | 'error';
    virusScanDate?: string;

    // Lifecycle metadata
    storageClass?: 'STANDARD' | 'STANDARD_IA' | 'GLACIER';
    movedToIaAt?: string;
    archivedAt?: string;
    protected?: boolean;
  };

  /**
   * Description or caption for the file
   */
  @Column({ nullable: true, length: 500 })
  description: string;

  /**
   * Tags for categorization and searching
   */
  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  /**
   * Error message if processing failed
   */
  @Column({ nullable: true })
  errorMessage: string;

  /**
   * Soft delete timestamp
   */
  @Column({ nullable: true })
  deletedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * File versions (for version history)
   */
  @OneToMany(() => FileVersion, (version) => version.file)
  versions: FileVersion[];

  /**
   * File variants (thumbnails, compressed, etc.)
   */
  @OneToMany(() => FileVariant, (variant) => variant.file)
  variants: FileVariant[];
}
