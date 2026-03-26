import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FileMetadata } from './file-metadata.entity';

/**
 * File Version Entity
 *
 * Stores historical versions of a file for version control.
 * When a file is updated, the old version is saved here.
 */
@Entity('file_versions')
@Index(['fileId', 'versionNumber'])
export class FileVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Parent file metadata
   */
  @Column()
  fileId: string;

  @ManyToOne(() => FileMetadata, (file) => file.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fileId' })
  file: FileMetadata;

  /**
   * Version number (1, 2, 3, ...)
   */
  @Column()
  versionNumber: number;

  /**
   * Storage key for this version
   */
  @Column()
  storageKey: string;

  /**
   * Size of this version in bytes
   */
  @Column({ type: 'bigint' })
  sizeBytes: number;

  /**
   * Checksum of this version
   */
  @Column({ nullable: true })
  checksum: string;

  /**
   * Reason for version change (optional)
   */
  @Column({ nullable: true, length: 255 })
  changeDescription: string;

  /**
   * Whether this is the current active version
   */
  @Column({ default: false })
  isCurrent: boolean;

  /**
   * User who created/changed this version
   */
  @Column({ nullable: true })
  changedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
