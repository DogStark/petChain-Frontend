import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserPreferenceService } from './services/user-preference.service';
import { UserSessionService } from './services/user-session.service';
import { UserActivityLogService } from './services/user-activity-log.service';
import { UserSearchService } from './services/user-search.service';
import { FileUploadService } from './services/file-upload.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RoleName } from '../../auth/constants/roles.enum';
import { of } from 'rxjs';

// simple stub guards
jest.mock('../../auth/guards/jwt-auth.guard');
jest.mock('../../auth/guards/roles.guard');

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    findOne: jest.fn(),
    getProfileCompletion: jest.fn(),
    updateProfile: jest.fn(),
    updateAvatar: jest.fn(),
    deactivateAccount: jest.fn(),
    reactivateAccount: jest.fn(),
  };

  const mockPref = {};
  const mockSession = {};
  const mockActivity = { logActivity: jest.fn() };
  const mockSearch = {};
  const mockFileUpload = { uploadAvatar: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        { provide: UserPreferenceService, useValue: mockPref },
        { provide: UserSessionService, useValue: mockSession },
        { provide: UserActivityLogService, useValue: mockActivity },
        { provide: UserSearchService, useValue: mockSearch },
        { provide: FileUploadService, useValue: mockFileUpload },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  const dummyUser = { id: 'u1', email: 'e@x', firstName: 'A', lastName: 'B' } as any;

  it('should return current profile with completion', async () => {
    mockUsersService.findOne.mockResolvedValue(dummyUser);
    mockUsersService.getProfileCompletion.mockResolvedValue({ completionScore: 50 });

    const result = await controller.getCurrentProfile(dummyUser as any);
    expect(mockUsersService.findOne).toHaveBeenCalledWith('u1');
    expect(result.profileCompletion.completionScore).toBe(50);
  });

  it('should support alias getMe', async () => {
    mockUsersService.findOne.mockResolvedValue(dummyUser);
    const result = await controller.getMe(dummyUser as any);
    expect(result).toEqual(dummyUser);
  });

  it('should update profile and log activity', async () => {
    const dto = { firstName: 'New' };
    mockUsersService.updateProfile.mockResolvedValue({ ...dummyUser, firstName: 'New' });
    const updated = await controller.updateProfile(dummyUser as any, dto as any);
    expect(mockUsersService.updateProfile).toHaveBeenCalledWith('u1', dto);
    expect(mockActivity.logActivity).toHaveBeenCalled();
    expect(updated.firstName).toBe('New');
  });

  it('should call alias replaceProfile', async () => {
    const dto = { lastName: 'Z' };
    jest.spyOn(controller, 'updateProfile');
    await controller.replaceProfile(dummyUser as any, dto as any);
    expect(controller.updateProfile).toHaveBeenCalledWith(dummyUser, dto);
  });

  it('should update avatar by url', async () => {
    mockUsersService.updateAvatar.mockResolvedValue({ ...dummyUser, avatarUrl: 'url' });
    const res = await controller.updateAvatar(dummyUser as any, { avatarUrl: 'url' });
    expect(res.avatarUrl).toBe('url');
    expect(mockActivity.logActivity).toHaveBeenCalled();
  });

  it('should upload avatar file via direct endpoint', async () => {
    // prepare file and services
    const file = { buffer: Buffer.from(''), mimetype: 'image/png', originalname: 'a.png' } as any;
    const fakeUrl = 'https://storage/avatars/a.png';
    const mockFileUpload = { uploadAvatar: jest.fn().mockResolvedValue(fakeUrl) };
    // override controller's fileUploadService
    (controller as any).fileUploadService = mockFileUpload;
    mockUsersService.updateAvatar.mockResolvedValue({ ...dummyUser, avatarUrl: fakeUrl });

    const res = await controller.uploadAvatarDirect(file, dummyUser as any);
    expect(mockFileUpload.uploadAvatar).toHaveBeenCalledWith(file, 'u1');
    expect(mockUsersService.updateAvatar).toHaveBeenCalledWith('u1', fakeUrl);
    expect(res.avatarUrl).toBe(fakeUrl);
  });

  it('should deactivate account and revoke sessions', async () => {
    mockUsersService.deactivateAccount.mockResolvedValue(undefined);
    // session service is empty; we just call method
    // ensure sessionService has method
    const spyRevokeAll = jest.fn();
    (controller as any).sessionService = { revokeAllSessions: spyRevokeAll };
    await controller.deactivateAccount(dummyUser as any);
    expect(mockUsersService.deactivateAccount).toHaveBeenCalledWith('u1');
    expect(mockActivity.logActivity).toHaveBeenCalled();
    expect(spyRevokeAll).toHaveBeenCalledWith('u1');
  });
});
