import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PetPhoto } from './entities/pet-photo.entity';
import { Pet } from './entities/pet.entity';
import { StorageService } from '../storage/storage.service';
import { ImageProcessingService } from '../processing/services/image-processing.service';

const MAX_PHOTOS_PER_PET = 10;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class PetPhotosService {
  private readonly logger = new Logger(PetPhotosService.name);

  constructor(
    @InjectRepository(PetPhoto)
    private readonly photoRepository: Repository<PetPhoto>,
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    private readonly storageService: StorageService,
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

  async getPhotos(petId: string): Promise<PetPhoto[]> {
    await this.ensurePetExists(petId);
    return this.photoRepository.find({
      where: { petId },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async uploadPhotos(
    petId: string,
    files: Express.Multer.File[],
  ): Promise<PetPhoto[]> {
    await this.ensurePetExists(petId);

    const existingCount = await this.photoRepository.count({
      where: { petId },
    });
    if (existingCount + files.length > MAX_PHOTOS_PER_PET) {
      throw new BadRequestException(
        `Cannot exceed ${MAX_PHOTOS_PER_PET} photos per pet. ` +
          `Currently ${existingCount}, trying to add ${files.length}.`,
      );
    }

    const validatedFiles = files.map((file) => {
      const detectedType = file.mimetype?.toLowerCase().trim();
      if (!ALLOWED_MIME_TYPES.includes(detectedType)) {
        throw new BadRequestException(
          `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        );
      }
      if (!this.hasValidImageMagicBytes(file.buffer)) {
        throw new BadRequestException('File content does not match an allowed image format');
      }
      // Return file with sanitized contentType to break taint flow
      return { file, contentType: detectedType as string };
    });

    const hasPrimary = await this.photoRepository.findOne({
      where: { petId, isPrimary: true },
    });

    const uploadedPhotos: PetPhoto[] = [];

    for (let i = 0; i < validatedFiles.length; i++) {
      const { file, contentType } = validatedFiles[i];

      const processed = await this.imageProcessingService.processImage(
        file.buffer,
        {
          stripMetadata: true,
          compress: true,
          generateThumbnail: true,
        },
      );

      const compressedBuffer = processed.compressed?.buffer ?? file.buffer;
      const thumbnailBuffer = processed.thumbnail?.buffer;

      const storageKey = this.storageService.generateKey({
        prefix: 'uploads',
        petId,
        variant: 'photos',
        filename: file.originalname,
      });

      const thumbnailStorageKey = this.storageService.generateKey({
        prefix: 'uploads',
        petId,
        variant: 'thumbnails',
        filename: file.originalname,
      });

      const [uploadResult, thumbnailResult] = await Promise.all([
        this.storageService.upload({
          key: storageKey,
          body: compressedBuffer,
          contentType: contentType, // sanitized, not raw file.mimetype
          metadata: { petId, originalName: file.originalname },
        }),
        thumbnailBuffer
          ? this.storageService.upload({
              key: thumbnailStorageKey,
              body: thumbnailBuffer,
              contentType: 'image/jpeg',
              metadata: { petId, variant: 'thumbnail' },
            })
          : Promise.resolve(null),
      ]);

      const photoUrl =
        this.storageService.getPublicUrl(storageKey) ||
        (await this.storageService.getSignedUrl({
          key: storageKey,
          operation: 'get',
          expiresIn: 604800, // 7 days
        }));

      const thumbnailUrl = thumbnailResult
        ? this.storageService.getPublicUrl(thumbnailStorageKey) ||
          (await this.storageService.getSignedUrl({
            key: thumbnailStorageKey,
            operation: 'get',
            expiresIn: 604800,
          }))
        : null;

      const photo = this.photoRepository.create({
        petId,
        photoUrl,
        thumbnailUrl: thumbnailUrl ?? photoUrl,
        storageKey,
        thumbnailStorageKey: thumbnailResult ? thumbnailStorageKey : null,
        isPrimary: !hasPrimary && i === 0,
        displayOrder: existingCount + i,
        mimeType: file.mimetype,
        fileSize: uploadResult.size,
        width: processed.compressed?.width ?? processed.original.width,
        height: processed.compressed?.height ?? processed.original.height,
        originalFilename: file.originalname,
      });

      const saved = await this.photoRepository.save(photo);
      uploadedPhotos.push(saved);

      this.logger.log(
        `Uploaded photo ${saved.id} for pet ${petId} (${file.originalname})`,
      );
    }

    return uploadedPhotos;
  }

  async setPrimary(petId: string, photoId: string): Promise<PetPhoto> {
    await this.ensurePetExists(petId);

    const photo = await this.photoRepository.findOne({
      where: { id: photoId, petId },
    });
    if (!photo) {
      throw new NotFoundException(
        `Photo ${photoId} not found for pet ${petId}`,
      );
    }

    await this.photoRepository.update({ petId }, { isPrimary: false });
    photo.isPrimary = true;
    return this.photoRepository.save(photo);
  }

  async reorderPhotos(petId: string, photoIds: string[]): Promise<PetPhoto[]> {
    await this.ensurePetExists(petId);

    const photos = await this.photoRepository.find({
      where: { petId, id: In(photoIds) },
    });

    if (photos.length !== photoIds.length) {
      throw new BadRequestException('Some photo IDs do not belong to this pet');
    }

    const updates = photoIds.map((id, index) =>
      this.photoRepository.update({ id, petId }, { displayOrder: index }),
    );
    await Promise.all(updates);

    return this.getPhotos(petId);
  }

  async deletePhoto(petId: string, photoId: string): Promise<void> {
    await this.ensurePetExists(petId);

    const photo = await this.photoRepository.findOne({
      where: { id: photoId, petId },
    });
    if (!photo) {
      throw new NotFoundException(
        `Photo ${photoId} not found for pet ${petId}`,
      );
    }

    const deletePromises: Promise<void>[] = [];
    if (photo.storageKey) {
      deletePromises.push(
        this.storageService.delete({ key: photo.storageKey }),
      );
    }
    if (photo.thumbnailStorageKey) {
      deletePromises.push(
        this.storageService.delete({ key: photo.thumbnailStorageKey }),
      );
    }

    await Promise.allSettled(deletePromises);
    const wasPrimary = photo.isPrimary;
    await this.photoRepository.remove(photo);

    if (wasPrimary) {
      const nextPhoto = await this.photoRepository.findOne({
        where: { petId },
        order: { displayOrder: 'ASC' },
      });
      if (nextPhoto) {
        nextPhoto.isPrimary = true;
        await this.photoRepository.save(nextPhoto);
      }
    }

    await this.reindexDisplayOrder(petId);
    this.logger.log(`Deleted photo ${photoId} from pet ${petId}`);
  }

  private async reindexDisplayOrder(petId: string): Promise<void> {
    const photos = await this.photoRepository.find({
      where: { petId },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });

    const updates = photos.map((photo, index) =>
      this.photoRepository.update(photo.id, { displayOrder: index }),
    );
    await Promise.all(updates);
  }

  private async ensurePetExists(petId: string): Promise<void> {
    const pet = await this.petRepository.findOne({ where: { id: petId } });
    if (!pet) {
      throw new NotFoundException(`Pet with ID ${petId} not found`);
    }
  }

  /** Verify file magic bytes to prevent type confusion attacks */
  private hasValidImageMagicBytes(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 4) return false;
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
    // WebP: RIFF....WEBP
    if (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length >= 12 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) return true;
    return false;
  }
}
