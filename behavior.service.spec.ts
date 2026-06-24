import { Test, TestingModule } from '@nestjs/testing';
import { BehaviorService } from './behavior.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Behavior } from './entities/behavior.entity';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateBehaviorDto } from './dto/create-behavior.dto';
import { UpdateBehaviorDto } from './dto/update-behavior.dto';

describe('BehaviorService', () => {
  let service: BehaviorService;
  let repository: Repository<Behavior>;

  // Mock Data
  const mockBehavior = {
    id: 'uuid-123',
    petId: 'pet-456',
    type: 'Aggression',
    description: 'Barked at mailman',
    severity: 3,
    metrics: { intensity: 'medium', duration: 30 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBehaviorRepository = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockResolvedValue(mockBehavior),
    find: jest.fn().mockResolvedValue([mockBehavior]),
    findOne: jest.fn().mockResolvedValue(mockBehavior),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BehaviorService,
        {
          provide: getRepositoryToken(Behavior),
          useValue: mockBehaviorRepository,
        },
      ],
    }).compile();

    service = module.get<BehaviorService>(BehaviorService);
    repository = module.get<Repository<Behavior>>(getRepositoryToken(Behavior));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateBehaviorDto = {
      petId: 'pet-456',
      type: 'Aggression',
      description: 'Barked at mailman',
      severity: 3,
      metrics: { intensity: 'medium', duration: 30 },
    };

    it('should successfully create a behavior log', async () => {
      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockBehavior);
    });

    it('should throw BadRequestException if severity is out of bounds (Business Logic)', async () => {
      const invalidDto = { ...createDto, severity: 11 }; // Assume 1-10 scale

      // Mocking a service-level validation check
      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if metrics are malformed', async () => {
      const invalidDto = { ...createDto, metrics: null } as any;

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll and filtering', () => {
    it('should return an array of behavior logs', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockBehavior]);
      expect(repository.find).toHaveBeenCalled();
    });

    it('should apply filters correctly when provided', async () => {
      const filters = { petId: 'pet-456', type: 'Aggression' };
      await service.findAll(filters);

      expect(repository.find).toHaveBeenCalledWith({
        where: filters,
      });
    });
  });

  describe('findOne', () => {
    it('should return a single behavior log', async () => {
      const result = await service.findOne('uuid-123');
      expect(result).toEqual(mockBehavior);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-123' } });
    });

    it('should throw NotFoundException if log does not exist', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateBehaviorDto = {
      description: 'Updated description',
      severity: 4,
    };

    it('should successfully update a behavior log', async () => {
      const updatedResult = { ...mockBehavior, ...updateDto };
      // Mock findOne twice: once for the initial existence check and once for the post-update return
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce(mockBehavior as any)
        .mockResolvedValueOnce(updatedResult as any);

      const result = await service.update('uuid-123', updateDto);
      expect(repository.update).toHaveBeenCalledWith('uuid-123', updateDto);
      expect(result).toEqual(updatedResult);
    });

    it('should throw BadRequestException for invalid update metrics', async () => {
      const invalidUpdate = { severity: -1 };
      await expect(service.update('uuid-123', invalidUpdate)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if record to update is missing', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should successfully delete a behavior log', async () => {
      // Mock existence check
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(mockBehavior as any);

      const result = await service.remove('uuid-123');

      expect(repository.delete).toHaveBeenCalledWith('uuid-123');
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException if trying to delete non-existent log', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null);

      await expect(service.remove('uuid-123')).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('Workflow: Behavior Tracking Logic', () => {
    it('should validate that a behavior log cannot be created without a valid pet reference', async () => {
      const noPetDto = { type: 'Anxiety', severity: 1 } as CreateBehaviorDto;

      await expect(service.create(noPetDto)).rejects.toThrow(BadRequestException);
    });

    it('should ensure timestamps are not manually overwritable during creation', async () => {
      const maliciousDto = {
        ...mockBehavior,
        createdAt: new Date('2000-01-01'), // Attempting to spoof history
      } as any;

      await service.create(maliciousDto);

      // Check that repository.create was called but we rely on DB/Repository for actual timestamping
      expect(repository.create).toHaveBeenCalled();
      const callArgs = (repository.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.createdAt).toBeUndefined(); // Assuming DTO strips it or service ignores it
    });
  });
});
