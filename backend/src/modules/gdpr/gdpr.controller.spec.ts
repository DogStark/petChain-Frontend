import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { GdprController } from './gdpr.controller';
import { GdprService } from './gdpr.service';
import { RolesService } from '../../auth/services/roles.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsService } from '../../auth/services/permissions.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { RoleName } from '../../auth/constants/roles.enum';

const mockGdprService = {
  requestExport: jest.fn(),
  requestErasure: jest.fn(),
  getConsents: jest.fn(),
  initDefaultConsents: jest.fn(),
  updateConsent: jest.fn(),
  requestDeletion: jest.fn(),
  processDeletion: jest.fn(),
  getDeletionStatus: jest.fn(),
  exportUserData: jest.fn(),
};

const mockRolesService = {
  getUserRoles: jest.fn(),
  getUserPermissions: jest.fn(),
};

const mockPermissionsService = {
  checkPermissionAccess: jest.fn().mockReturnValue(true),
};

function makeUser(id: string): User {
  return { id, isActive: true } as User;
}

describe('GdprController', () => {
  let controller: GdprController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GdprController],
      providers: [
        { provide: GdprService, useValue: mockGdprService },
        { provide: RolesService, useValue: mockRolesService },
        { provide: PermissionsService, useValue: mockPermissionsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GdprController>(GdprController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('JwtAuthGuard applied at controller level', () => {
    it('has JwtAuthGuard applied', () => {
      const guards = Reflect.getMetadata('__guards__', GdprController);
      expect(guards).toBeDefined();
      expect(guards.some((g: unknown) => g === JwtAuthGuard)).toBe(true);
    });
  });

  describe('ownership enforcement', () => {
    describe('getConsents', () => {
      it('allows owner to read their own consents', async () => {
        mockRolesService.getUserRoles.mockResolvedValue([]);
        mockGdprService.getConsents.mockResolvedValue([]);
        const caller = makeUser('user-1');

        await expect(
          controller.getConsents('user-1', caller),
        ).resolves.toBeDefined();
        expect(mockGdprService.getConsents).toHaveBeenCalledWith('user-1');
      });

      it('throws 403 when non-owner tries to read another user consents', async () => {
        mockRolesService.getUserRoles.mockResolvedValue([]);
        const caller = makeUser('user-1');

        await expect(
          controller.getConsents('user-2', caller),
        ).rejects.toThrow(ForbiddenException);
        expect(mockGdprService.getConsents).not.toHaveBeenCalled();
      });

      it('allows admin to read any user consents', async () => {
        mockRolesService.getUserRoles.mockResolvedValue([
          { name: RoleName.Admin },
        ]);
        mockGdprService.getConsents.mockResolvedValue([]);
        const caller = makeUser('admin-1');

        await expect(
          controller.getConsents('user-2', caller),
        ).resolves.toBeDefined();
      });
    });

    describe('exportData', () => {
      it('throws 403 when non-owner tries to export another user data', async () => {
        mockRolesService.getUserRoles.mockResolvedValue([]);
        const caller = makeUser('user-1');

        await expect(
          controller.exportData('user-2', caller),
        ).rejects.toThrow(ForbiddenException);
        expect(mockGdprService.exportUserData).not.toHaveBeenCalled();
      });
    });

    describe('requestDeletion', () => {
      it('throws 403 when non-owner requests deletion for another user', async () => {
        mockRolesService.getUserRoles.mockResolvedValue([]);
        const caller = makeUser('user-1');

        await expect(
          controller.requestDeletion('user-2', caller, {} as any),
        ).rejects.toThrow(ForbiddenException);
        expect(mockGdprService.requestDeletion).not.toHaveBeenCalled();
      });
    });

    describe('getDeletionStatus', () => {
      it('throws 403 when non-owner checks deletion status for another user', async () => {
        mockRolesService.getUserRoles.mockResolvedValue([]);
        const caller = makeUser('user-1');

        await expect(
          controller.getDeletionStatus('user-2', caller),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });
});
