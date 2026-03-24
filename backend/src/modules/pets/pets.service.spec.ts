import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PetsService } from './pets.service';
import { Pet } from './entities/pet.entity';
import { PetShare } from './entities/pet-share.entity';
import { UsersService } from '../users/users.service';

describe('PetsService', () => {
  let service: PetsService;

  const mockPetRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    softRemove: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPetShareRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        { provide: getRepositoryToken(Pet), useValue: mockPetRepository },
        { provide: getRepositoryToken(PetShare), useValue: mockPetShareRepository },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<PetsService>(PetsService);
    jest.clearAllMocks();
  });

  it('creates pet with owner binding and microchip alias', async () => {
    const ownerId = 'owner-1';
    const dto: any = {
      name: 'Max',
      species: 'dog',
      dateOfBirth: new Date(),
      microchipId: 'chip-1',
    };
    const created = { id: 'pet-1', ownerId, ...dto };

    mockPetRepository.create.mockReturnValue(created);
    mockPetRepository.save.mockResolvedValue(created);

    const result = await service.create(ownerId, dto);

    expect(mockPetRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId, microchipNumber: 'chip-1' }),
    );
    expect(result).toEqual(created);
  });

  it('defaults pagination to 10 per page', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    mockPetRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAllForOwner('owner-1', {} as any);

    expect(qb.take).toHaveBeenCalledWith(10);
    expect(result.limit).toBe(10);
    expect(result.page).toBe(1);
  });

  it('supports soft delete and restore', async () => {
    const pet = { id: 'pet-1', ownerId: 'owner-1', deletedAt: null };
    const deletedPet = { ...pet, deletedAt: new Date() };

    mockPetRepository.findOne.mockResolvedValueOnce(pet);
    await service.softDeleteForUser('pet-1', 'owner-1');
    expect(mockPetRepository.softRemove).toHaveBeenCalledWith(pet);

    mockPetRepository.findOne.mockResolvedValueOnce(deletedPet);
    mockPetRepository.restore.mockResolvedValue({ affected: 1 });
    mockPetRepository.findOne.mockResolvedValueOnce({ ...pet, deletedAt: null });

    const restored = await service.restoreForUser('pet-1', 'owner-1');
    expect(mockPetRepository.restore).toHaveBeenCalledWith('pet-1');
    expect(restored.id).toBe('pet-1');
  });

  it('transfers ownership and revokes shares', async () => {
    const pet = { id: 'pet-1', ownerId: 'owner-1', deletedAt: null };
    const transferred = { ...pet, ownerId: 'owner-2' };

    mockUsersService.findOne.mockResolvedValue({ id: 'owner-2' });
    mockPetRepository.findOne.mockResolvedValue(pet);
    mockPetRepository.save.mockResolvedValue(transferred);

    const result = await service.transferOwnership('pet-1', 'owner-1', 'owner-2');

    expect(mockPetShareRepository.delete).toHaveBeenCalledWith({ petId: 'pet-1' });
    expect(result.ownerId).toBe('owner-2');
  });

  it('rejects transfer to same owner', async () => {
    await expect(
      service.transferOwnership('pet-1', 'owner-1', 'owner-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('shares pet with family and allows unshare', async () => {
    mockPetRepository.findOne.mockResolvedValue({ id: 'pet-1', ownerId: 'owner-1' });
    mockUsersService.findOne.mockResolvedValue({ id: 'user-2' });
    mockPetShareRepository.findOne.mockResolvedValue(null);
    mockPetShareRepository.create.mockReturnValue({
      id: 'share-1',
      petId: 'pet-1',
      sharedWithUserId: 'user-2',
      isActive: true,
    });
    mockPetShareRepository.save.mockResolvedValue({
      id: 'share-1',
      petId: 'pet-1',
      sharedWithUserId: 'user-2',
      isActive: true,
    });

    const shared = await service.sharePetWithFamily('pet-1', 'owner-1', {
      sharedWithUserId: 'user-2',
      canEdit: false,
    });
    expect(shared.sharedWithUserId).toBe('user-2');

    mockPetRepository.findOne.mockResolvedValue({ id: 'pet-1', ownerId: 'owner-1' });
    mockPetShareRepository.findOne.mockResolvedValue({
      id: 'share-1',
      petId: 'pet-1',
      sharedWithUserId: 'user-2',
      isActive: true,
    });

    await service.unsharePetWithFamily('pet-1', 'owner-1', 'user-2');
    expect(mockPetShareRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
  });

  it('denies update when user has no owner/edit-share permission', async () => {
    mockPetRepository.findOne.mockResolvedValue(null);
    mockPetShareRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateForUser('pet-1', 'user-no-access', { name: 'New name' } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lists pets and gets one pet with relations', async () => {
    mockPetRepository.find.mockResolvedValue([{ id: 'pet-1' }]);
    const list = await service.findAll('owner-1');
    expect(list).toHaveLength(1);

    mockPetRepository.findOne.mockResolvedValue({ id: 'pet-1', deletedAt: null });
    const one = await service.findOne('pet-1');
    expect(one.id).toBe('pet-1');
  });

  it('finds shared pets with pagination', async () => {
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'pet-2' }], 1]),
    };
    mockPetRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findSharedWithUser('u2', { name: 'Mi' } as any);
    expect(result.total).toBe(1);
    expect(qb.andWhere).toHaveBeenCalled();
  });

  it('updates pet when owner has access', async () => {
    mockPetRepository.findOne
      .mockResolvedValueOnce({ id: 'pet-1' }) // verifyOwnership
      .mockResolvedValueOnce({ id: 'pet-1', name: 'Old', deletedAt: null }); // findOne
    mockPetRepository.save.mockResolvedValue({ id: 'pet-1', name: 'New' });

    const updated = await service.updateForUser('pet-1', 'owner-1', {
      name: 'New',
      microchipId: 'chip-new',
    } as any);

    expect(updated.name).toBe('New');
    expect(mockPetRepository.save).toHaveBeenCalled();
  });

  it('returns access true for shared user', async () => {
    mockPetRepository.findOne.mockResolvedValue(null); // not owner
    mockPetShareRepository.findOne.mockResolvedValue({ id: 'share-1' });

    const allowed = await service.hasAccessToPet('pet-1', 'shared-user');
    expect(allowed).toBe(true);
  });

  it('lists active shares for owner', async () => {
    mockPetRepository.findOne.mockResolvedValue({ id: 'pet-1', ownerId: 'owner-1' });
    mockPetShareRepository.find.mockResolvedValue([{ id: 'share-1' }]);

    const shares = await service.listPetShares('pet-1', 'owner-1');
    expect(shares).toHaveLength(1);
  });

  it('calculates age and life stage helpers', () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 3);

    const age = service.calculateAge(dob);
    const weeks = service.calculateAgeInWeeks(dob);
    const stage = service.getLifeStage(dob, 'dog' as any);

    expect(age.years).toBeGreaterThanOrEqual(2);
    expect(weeks).toBeGreaterThan(0);
    expect(stage).toBeDefined();
  });
});
