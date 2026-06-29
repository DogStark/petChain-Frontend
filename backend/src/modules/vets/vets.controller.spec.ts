import { Test, TestingModule } from '@nestjs/testing';
import { VetsController } from './vets.controller';
import { VetsService } from './vets.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('VetsController', () => {
  let controller: VetsController;
  let service: VetsService;

  const mockVetsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VetsController],
      providers: [
        {
          provide: VetsService,
          useValue: mockVetsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<VetsController>(VetsController);
    service = module.get<VetsService>(VetsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a vet', async () => {
      const createDto = { name: 'Dr. Smith', licenseNumber: '12345' };
      mockVetsService.create.mockResolvedValue({
        id: 'vet-1',
        ...createDto,
      });

      const result = await controller.create(createDto);

      expect(result.id).toBe('vet-1');
      expect(mockVetsService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return all vets', async () => {
      const mockVets = [
        { id: 'vet-1', name: 'Dr. Smith' },
        { id: 'vet-2', name: 'Dr. Jones' },
      ];
      mockVetsService.findAll.mockResolvedValue(mockVets);

      const result = await controller.findAll();

      expect(result).toEqual(mockVets);
    });

    it('should search vets by name', async () => {
      const mockVets = [{ id: 'vet-1', name: 'Dr. Smith' }];
      mockVetsService.findAll.mockResolvedValue(mockVets);

      const result = await controller.findAll('Smith');

      expect(result).toEqual(mockVets);
      expect(mockVetsService.findAll).toHaveBeenCalledWith('Smith');
    });
  });

  describe('findOne', () => {
    it('should return a vet by ID', async () => {
      const mockVet = { id: 'vet-1', name: 'Dr. Smith' };
      mockVetsService.findOne.mockResolvedValue(mockVet);

      const result = await controller.findOne('vet-1');

      expect(result).toEqual(mockVet);
      expect(mockVetsService.findOne).toHaveBeenCalledWith('vet-1');
    });
  });

  describe('update', () => {
    it('should update a vet', async () => {
      const updateDto = { name: 'Dr. Smith Jr.' };
      mockVetsService.update.mockResolvedValue({
        id: 'vet-1',
        ...updateDto,
      });

      const result = await controller.update('vet-1', updateDto);

      expect(result.name).toBe('Dr. Smith Jr.');
      expect(mockVetsService.update).toHaveBeenCalledWith('vet-1', updateDto);
    });
  });

  describe('remove', () => {
    it('should delete a vet', async () => {
      mockVetsService.remove.mockResolvedValue({ id: 'vet-1' });

      const result = await controller.remove('vet-1');

      expect(result.id).toBe('vet-1');
      expect(mockVetsService.remove).toHaveBeenCalledWith('vet-1');
    });
  });
});
