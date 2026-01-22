import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../modules/users/users.service';
import { User } from '../../modules/users/entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: UsersService;
  let configService: ConfigService;

  const mockUsersService = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Set up mock before creating module
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'auth.jwtSecret') {
        return 'test-secret-key-min-32-chars-for-jwt-strategy';
      }
      return null;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get<UsersService>(UsersService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
    
    // Reset mock implementation after clear
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'auth.jwtSecret') {
        return 'test-secret-key-min-32-chars-for-jwt-strategy';
      }
      return null;
    });
  });

  describe('validate', () => {
    const mockPayload = {
      sub: 'user-id',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it('should return user if found and active', async () => {
      const mockUser: User = {
        id: 'user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        emailVerified: true,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(mockPayload);

      expect(usersService.findOne).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findOne.mockRejectedValue(new Error('User not found'));

      await expect(strategy.validate(mockPayload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const inactiveUser: User = {
        id: 'user-id',
        email: 'test@example.com',
        isActive: false,
      } as User;

      mockUsersService.findOne.mockResolvedValue(inactiveUser);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
