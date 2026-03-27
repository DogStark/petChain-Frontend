import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repo: Repository<User>;

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const makeUserQb = (result: any) => ({
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get<Repository<User>>(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and save a user', async () => {
      const dto = {
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        password: 'pw',
      };
      const created = { id: '1', ...dto } as any;
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create(dto as any);
      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('should return list of users', async () => {
      const users = [{ id: '1' }];
      mockRepo.createQueryBuilder.mockReturnValue({
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(users),
      } as any);
      const result = await service.findAll();
      expect(result).toEqual(users);
    });
  });

  describe('findOne', () => {
    it('should return user when found', async () => {
      const user = { id: '1' } as any;
      mockRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      } as any);
      const result = await service.findOne('1');
      expect(result).toEqual(user);
    });

    it('should throw if not found', async () => {
      mockRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any);
      await expect(service.findOne('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    const existing = { id: '1', email: 'old@x.com' } as any;
    it('updates basic fields', async () => {
      mockRepo.save.mockImplementation((u) => Promise.resolve(u));
      const dto = { email: 'new@x.com', firstName: 'New' };
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(makeUserQb(existing) as any)
        .mockReturnValueOnce(makeUserQb(null) as any);
      const out = await service.updateProfile('1', dto as any);
      expect(out.email).toBe(dto.email);
      expect(out.firstName).toBe(dto.firstName);
    });

    it('throws conflict when email taken', async () => {
      const other = { id: '2', email: 'taken@x.com' } as any;
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(makeUserQb(existing) as any)
        .mockReturnValueOnce(makeUserQb(other) as any);
      await expect(
        service.updateProfile('1', { email: 'taken@x.com' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getProfileCompletion', () => {
    it('should calculate missing fields correctly', async () => {
      const user = {
        id: '1',
        firstName: 'A',
        lastName: '',
        email: 'e@e.com',
        phone: null,
        avatarUrl: '',
        dateOfBirth: null,
        address: 'Addr',
        city: '',
        country: null,
      } as any;
      mockRepo.createQueryBuilder.mockReturnValue(makeUserQb(user) as any);

      const { missingFields, completionScore } =
        await service.getProfileCompletion('1');
      expect(missingFields).toEqual(
        expect.arrayContaining([
          'lastName',
          'phone',
          'avatarUrl',
          'dateOfBirth',
          'city',
          'country',
        ]),
      );
      expect(completionScore).toBeLessThan(100);
    });
  });

  describe('deactivate/reactivate/softDelete', () => {
    const user = {
      id: '1',
      isDeactivated: false,
      isActive: true,
      deletedAt: null,
      email: 'a@b',
    } as any;
    it('deactivates account', async () => {
      mockRepo.createQueryBuilder.mockReturnValue(makeUserQb(user) as any);
      await service.deactivateAccount('1');
      expect(user.isDeactivated).toBe(true);
      expect(user.isActive).toBe(false);
    });
    it('reactivates account', async () => {
      user.isDeactivated = true;
      user.isActive = false;
      mockRepo.createQueryBuilder.mockReturnValue(makeUserQb(user) as any);
      await service.reactivateAccount('1');
      expect(user.isDeactivated).toBe(false);
      expect(user.isActive).toBe(true);
    });
    it('soft deletes', async () => {
      user.deletedAt = null;
      user.isActive = true;
      mockRepo.createQueryBuilder.mockReturnValue(makeUserQb(user) as any);
      const out = await service.softDeleteUser('1');
      expect(out.deletedAt).toBeInstanceOf(Date);
      expect(out.isActive).toBe(false);
      expect(out.email).toMatch(/^deleted-/);
    });
  });
});
