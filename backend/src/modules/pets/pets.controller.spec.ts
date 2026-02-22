import { Test, TestingModule } from '@nestjs/testing';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';
import { LostPetsService } from '../lost-pets/lost-pets.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

jest.mock('../lost-pets/lost-pets.service', () => ({
  LostPetsService: class LostPetsService {},
}));

describe('PetsController', () => {
  let controller: PetsController;

  const mockPetsService = {
    create: jest.fn(),
    findAllForOwner: jest.fn(),
    findSharedWithUser: jest.fn(),
    findOneForUser: jest.fn(),
    updateForUser: jest.fn(),
    softDeleteForUser: jest.fn(),
    restoreForUser: jest.fn(),
    transferOwnership: jest.fn(),
    sharePetWithFamily: jest.fn(),
    unsharePetWithFamily: jest.fn(),
    listPetShares: jest.fn(),
    calculateAge: jest.fn(),
    getLifeStage: jest.fn(),
  };

  const mockLostPetsService = {
    reportLost: jest.fn(),
    reportFound: jest.fn(),
    updateLostMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PetsController],
      providers: [
        { provide: PetsService, useValue: mockPetsService },
        { provide: LostPetsService, useValue: mockLostPetsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PetsController>(PetsController);
    jest.clearAllMocks();
  });

  it('creates pet for authenticated user', async () => {
    const user = { id: 'user-1' } as any;
    const dto = { name: 'Buddy' } as any;
    mockPetsService.create.mockResolvedValue({ id: 'pet-1', ...dto });

    const result = await controller.create(dto, user);

    expect(mockPetsService.create).toHaveBeenCalledWith('user-1', dto);
    expect(result.id).toBe('pet-1');
  });

  it('lists owner pets with pagination query', async () => {
    const user = { id: 'user-1' } as any;
    const query = { page: 2, limit: 10 } as any;
    mockPetsService.findAllForOwner.mockResolvedValue({
      data: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 1,
    });

    const result = await controller.findMyPets(user, query);

    expect(mockPetsService.findAllForOwner).toHaveBeenCalledWith('user-1', query);
    expect(result.limit).toBe(10);
  });

  it('supports transfer ownership', async () => {
    const user = { id: 'owner-1' } as any;
    mockPetsService.transferOwnership.mockResolvedValue({
      id: 'pet-1',
      ownerId: 'owner-2',
    });

    const result = await controller.transferOwnership(
      'pet-1',
      { newOwnerId: 'owner-2' },
      user,
    );

    expect(mockPetsService.transferOwnership).toHaveBeenCalledWith(
      'pet-1',
      'owner-1',
      'owner-2',
    );
    expect(result.ownerId).toBe('owner-2');
  });

  it('soft deletes pet', async () => {
    const user = { id: 'owner-1' } as any;
    mockPetsService.softDeleteForUser.mockResolvedValue(undefined);

    await controller.remove('pet-1', user);
    expect(mockPetsService.softDeleteForUser).toHaveBeenCalledWith(
      'pet-1',
      'owner-1',
    );
  });

  it('handles shared pets endpoints', async () => {
    const user = { id: 'user-1' } as any;
    mockPetsService.findSharedWithUser.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 1 });
    mockPetsService.sharePetWithFamily.mockResolvedValue({ id: 'share-1' });
    mockPetsService.listPetShares.mockResolvedValue([{ id: 'share-1' }]);
    mockPetsService.unsharePetWithFamily.mockResolvedValue(undefined);

    await controller.findSharedWithMe(user, { page: 1 } as any);
    await controller.sharePet('pet-1', { sharedWithUserId: 'u2', canEdit: true }, user);
    await controller.listPetShares('pet-1', user);
    await controller.unsharePet('pet-1', 'u2', user);

    expect(mockPetsService.findSharedWithUser).toHaveBeenCalledWith('user-1', { page: 1 });
    expect(mockPetsService.sharePetWithFamily).toHaveBeenCalledWith('pet-1', 'user-1', {
      sharedWithUserId: 'u2',
      canEdit: true,
    });
  });

  it('handles single pet, update, restore and health summary', async () => {
    const user = { id: 'owner-1' } as any;
    const pet = {
      id: 'pet-1',
      name: 'Milo',
      dateOfBirth: new Date('2020-01-01'),
      species: 'dog',
      breed: { commonHealthIssues: ['issue'] },
      insurancePolicy: 'plan',
    };

    mockPetsService.findOneForUser.mockResolvedValue(pet);
    mockPetsService.updateForUser.mockResolvedValue({ ...pet, name: 'Updated' });
    mockPetsService.restoreForUser.mockResolvedValue(pet);
    mockPetsService.calculateAge.mockReturnValue({ years: 5, months: 0 });
    mockPetsService.getLifeStage.mockReturnValue('Adult');

    await controller.findOne('pet-1', user);
    await controller.update('pet-1', { name: 'Updated' } as any, user);
    await controller.restorePet('pet-1', user);
    const summary = await controller.getHealthSummary('pet-1', user);

    expect(summary.name).toBe('Milo');
    expect(summary.lifeStage).toBe('Adult');
  });

  it('handles lost pet endpoints', async () => {
    const user = { id: 'owner-1' } as any;
    mockLostPetsService.reportLost.mockResolvedValue({ id: 'r1' });
    mockLostPetsService.reportFound.mockResolvedValue({ id: 'r1', status: 'FOUND' });
    mockLostPetsService.updateLostMessage.mockResolvedValue({ id: 'r1', customMessage: 'msg' });

    await controller.reportLost('pet-1', { customMessage: 'help' } as any, user);
    await controller.reportFound('pet-1', { foundLocation: 'park' } as any, user);
    await controller.updateLostMessage('pet-1', { customMessage: 'msg' } as any, user);

    expect(mockLostPetsService.reportLost).toHaveBeenCalledWith('pet-1', 'owner-1', { customMessage: 'help' });
  });
});
