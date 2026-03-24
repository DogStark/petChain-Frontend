import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { Pet } from './entities/pet.entity';
import { PetShare } from './entities/pet-share.entity';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { QueryPetsDto } from './dto/query-pets.dto';
import { SharePetDto } from './dto/share-pet.dto';
import { PetSpecies } from './entities/pet-species.enum';
import { UsersService } from '../users/users.service';

export interface PaginatedPetsResult {
  data: Pet[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class PetsService {
  private readonly defaultLimit = 10;
  private readonly maxLimit = 100;

  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(PetShare)
    private readonly petShareRepository: Repository<PetShare>,
    private readonly usersService: UsersService,
  ) {}

  async create(ownerId: string, createPetDto: CreatePetDto): Promise<Pet> {
    const { microchipId, microchipNumber, ...rest } = createPetDto;

    const payload: Partial<Pet> = {
      ...rest,
      ownerId,
      microchipNumber: microchipNumber ?? microchipId,
    };

    const pet = this.petRepository.create(payload);

    return await this.petRepository.save(pet);
  }

  async findAll(ownerId?: string): Promise<Pet[]> {
    const where = ownerId
      ? { ownerId, deletedAt: IsNull() }
      : { deletedAt: IsNull() };

    return await this.petRepository.find({
      where,
      relations: ['breed', 'owner', 'photos'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAllForOwner(
    ownerId: string,
    query: QueryPetsDto,
  ): Promise<PaginatedPetsResult> {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const includeDeleted = this.isTrue(query.includeDeleted);

    const qb = this.petRepository
      .createQueryBuilder('pet')
      .leftJoinAndSelect('pet.breed', 'breed')
      .leftJoinAndSelect('pet.photos', 'photos')
      .where('pet.ownerId = :ownerId', { ownerId });

    if (!includeDeleted) {
      qb.andWhere('pet.deletedAt IS NULL');
    }

    this.applyFilters(qb, query);

    qb.orderBy('pet.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findSharedWithUser(
    userId: string,
    query: QueryPetsDto,
  ): Promise<PaginatedPetsResult> {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);

    const qb = this.petRepository
      .createQueryBuilder('pet')
      .innerJoinAndSelect(
        'pet.shares',
        'share',
        'share.sharedWithUserId = :userId AND share.isActive = :isActive',
        { userId, isActive: true },
      )
      .leftJoinAndSelect('pet.breed', 'breed')
      .leftJoinAndSelect('pet.photos', 'photos')
      .leftJoinAndSelect('pet.owner', 'owner')
      .where('pet.deletedAt IS NULL');

    this.applyFilters(qb, query);

    qb.orderBy('pet.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, withDeleted = false): Promise<Pet> {
    const pet = await this.petRepository.findOne({
      where: { id },
      withDeleted,
      relations: ['breed', 'owner', 'photos'],
    });

    if (!pet || (!withDeleted && pet.deletedAt)) {
      throw new NotFoundException(`Pet with ID ${id} not found`);
    }

    return pet;
  }

  async findOneForUser(
    id: string,
    userId: string,
    withDeleted = false,
  ): Promise<Pet> {
    const pet = await this.findOne(id, withDeleted);
    const hasAccess = await this.hasAccessToPet(id, userId);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this pet');
    }

    if (!withDeleted && pet.deletedAt) {
      throw new NotFoundException(`Pet with ID ${id} not found`);
    }

    return pet;
  }

  async updateForUser(
    id: string,
    userId: string,
    updatePetDto: UpdatePetDto,
  ): Promise<Pet> {
    await this.assertCanEdit(id, userId);
    const pet = await this.findOne(id);

    const payload: Partial<Pet> = {
      ...updatePetDto,
    };

    if (updatePetDto.microchipId && !updatePetDto.microchipNumber) {
      payload.microchipNumber = updatePetDto.microchipId;
    }

    Object.assign(pet, payload);
    return await this.petRepository.save(pet);
  }

  async softDeleteForUser(id: string, ownerId: string): Promise<void> {
    const pet = await this.findOwnedPet(id, ownerId, true);
    if (pet.deletedAt) {
      return;
    }
    await this.petRepository.softRemove(pet);
  }

  async restoreForUser(id: string, ownerId: string): Promise<Pet> {
    const pet = await this.findOwnedPet(id, ownerId, true);
    if (!pet.deletedAt) {
      return pet;
    }

    await this.petRepository.restore(id);
    return this.findOne(id);
  }

  async transferOwnership(
    petId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ): Promise<Pet> {
    if (currentOwnerId === newOwnerId) {
      throw new BadRequestException('New owner must be different');
    }

    await this.usersService.findOne(newOwnerId);
    const pet = await this.findOwnedPet(petId, currentOwnerId);

    pet.ownerId = newOwnerId;
    const updated = await this.petRepository.save(pet);

    // Ownership transfer revokes previous sharing grants.
    await this.petShareRepository.delete({ petId });

    return updated;
  }

  async sharePetWithFamily(
    petId: string,
    ownerId: string,
    dto: SharePetDto,
  ): Promise<PetShare> {
    if (dto.sharedWithUserId === ownerId) {
      throw new BadRequestException('Cannot share a pet with yourself');
    }

    await this.findOwnedPet(petId, ownerId);
    await this.usersService.findOne(dto.sharedWithUserId);

    const existing = await this.petShareRepository.findOne({
      where: { petId, sharedWithUserId: dto.sharedWithUserId },
    });

    if (existing) {
      existing.isActive = true;
      existing.canEdit = !!dto.canEdit;
      existing.sharedByUserId = ownerId;
      return await this.petShareRepository.save(existing);
    }

    const share = this.petShareRepository.create({
      petId,
      sharedWithUserId: dto.sharedWithUserId,
      sharedByUserId: ownerId,
      canEdit: !!dto.canEdit,
      isActive: true,
    });

    return await this.petShareRepository.save(share);
  }

  async unsharePetWithFamily(
    petId: string,
    ownerId: string,
    sharedWithUserId: string,
  ): Promise<void> {
    await this.findOwnedPet(petId, ownerId);

    const share = await this.petShareRepository.findOne({
      where: { petId, sharedWithUserId, isActive: true },
    });

    if (!share) {
      throw new NotFoundException('Active pet share not found');
    }

    share.isActive = false;
    await this.petShareRepository.save(share);
  }

  async listPetShares(petId: string, ownerId: string): Promise<PetShare[]> {
    await this.findOwnedPet(petId, ownerId);

    return await this.petShareRepository.find({
      where: { petId, isActive: true },
      relations: ['sharedWithUser', 'sharedByUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async verifyOwnership(petId: string, ownerId: string): Promise<boolean> {
    const pet = await this.petRepository.findOne({
      where: { id: petId, ownerId, deletedAt: IsNull() },
      select: ['id'],
    });
    return !!pet;
  }

  async hasAccessToPet(petId: string, userId: string): Promise<boolean> {
    const isOwner = await this.verifyOwnership(petId, userId);
    if (isOwner) return true;

    const share = await this.petShareRepository.findOne({
      where: { petId, sharedWithUserId: userId, isActive: true },
      select: ['id'],
    });

    return !!share;
  }

  calculateAge(dateOfBirth: Date): { years: number; months: number } {
    const now = new Date();
    const dob = new Date(dateOfBirth);
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();

    if (months < 0 || (months === 0 && now.getDate() < dob.getDate())) {
      years--;
      months += 12;
    }

    if (now.getDate() < dob.getDate()) {
      months--;
    }
    if (months < 0) {
      months += 12;
    }

    return { years, months };
  }

  calculateAgeInWeeks(dateOfBirth: Date): number {
    const now = new Date();
    const dob = new Date(dateOfBirth);
    const diffTime = Math.abs(now.getTime() - dob.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
  }

  getLifeStage(dateOfBirth: Date, species: PetSpecies): string {
    const { years } = this.calculateAge(dateOfBirth);

    if (species === PetSpecies.DOG || species === PetSpecies.CAT) {
      if (years < 1) return 'Junior';
      if (years < 7) return 'Adult';
      return 'Senior';
    }

    if (years < 1) return 'Young';
    if (years < 5) return 'Adult';
    return 'Senior';
  }

  private normalizePage(page?: number): number {
    if (!page || Number.isNaN(page) || page < 1) return 1;
    return page;
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit) || limit < 1) return this.defaultLimit;
    return Math.min(limit, this.maxLimit);
  }

  private isTrue(value?: string): boolean {
    return value === 'true';
  }

  private applyFilters(
    qb: SelectQueryBuilder<Pet>,
    query: QueryPetsDto,
  ): void {
    if (query.species) {
      qb.andWhere('pet.species = :species', { species: query.species });
    }

    if (query.gender) {
      qb.andWhere('pet.gender = :gender', { gender: query.gender });
    }

    if (query.breedId) {
      qb.andWhere('pet.breedId = :breedId', { breedId: query.breedId });
    }

    if (query.name) {
      qb.andWhere('pet.name ILIKE :name', { name: `%${query.name}%` });
    }

    if (query.neutered !== undefined) {
      qb.andWhere('pet.neutered = :neutered', {
        neutered: this.isTrue(query.neutered),
      });
    }
  }

  private async findOwnedPet(
    petId: string,
    ownerId: string,
    withDeleted = false,
  ): Promise<Pet> {
    const pet = await this.petRepository.findOne({
      where: { id: petId, ownerId },
      withDeleted,
      relations: ['breed', 'owner', 'photos'],
    });

    if (!pet) {
      throw new NotFoundException('Pet not found for this owner');
    }

    return pet;
  }

  private async assertCanEdit(petId: string, userId: string): Promise<void> {
    const isOwner = await this.verifyOwnership(petId, userId);
    if (isOwner) return;

    const editableShare = await this.petShareRepository.findOne({
      where: {
        petId,
        sharedWithUserId: userId,
        isActive: true,
        canEdit: true,
      },
      select: ['id'],
    });

    if (!editableShare) {
      throw new ForbiddenException('You do not have permission to edit this pet');
    }
  }
}
