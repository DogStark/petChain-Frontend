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
import { VariantType } from './variant-type.enum';

/**
 * File Variant Entity
 *
 * Stores processed variants of files (thumbnails, compressed versions, etc.)
 */
@Entity('file_variants')
@Index(['fileId', 'variantType'])
export class FileVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Parent file metadata
   */
  @Column()
  fileId: string;

  @ManyToOne(() => FileMetadata, (file) => file.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fileId' })
  file: FileMetadata;

  /**
   * Type of variant
   */
  @Column({
    type: 'enum',
    enum: VariantType,
  })
  variantType: VariantType;

  /**
   * Storage key for this variant
   */
  @Column()
  storageKey: string;

  /**
   * Width in pixels (for images/videos)
   */
  @Column({ nullable: true })
  width: number;

  /**
   * Height in pixels (for images/videos)
   */
  @Column({ nullable: true })
  height: number;

  /**
   * Size of this variant in bytes
   */
  @Column({ type: 'bigint' })
  sizeBytes: number;

  /**
   * MIME type of the variant (may differ from original)
   */
  @Column()
  mimeType: string;

  /**
   * Quality setting used for compression (0-100)
   */
  @Column({ nullable: true })
  quality: number;

  /**
   * Format of the variant (e.g., 'webp', 'mp4')
   */
  @Column({ nullable: true })
  format: string;

  @CreateDateColumn()
  createdAt: Date;
}
