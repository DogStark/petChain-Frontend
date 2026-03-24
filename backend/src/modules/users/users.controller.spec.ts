import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserPreferenceService } from './services/user-preference.service';
import { UserSessionService } from './services/user-session.service';
import { UserActivityLogService } from './services/user-activity-log.service';
import { UserSearchService } from './services/user-search.service';
import { FileUploadService } from './services/file-upload.service';
import { OnboardingService } from './services/onboarding.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

jest.mock('../../auth/guards/jwt-auth.guard');
jest.mock('../../auth/guards/roles.guard');

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getPublicProfile: jest.fn(),
    getProfileCompletion: jest.fn(),
    updateProfile: jest.fn(),
    updateAvatar: jest.fn(),
    deactivateAccount: jest.fn(),
    reactivateAccount: jest.fn(),
    softDeleteUser: jest.fn(),
  };

  const mockPref = {
    createDefaultPreferences: jest.fn(),
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    getNotificationPreferences: jest.fn(),
    updateNotificationSettings: jest.fn(),
    getPrivacySettings: jest.fn(),
    updatePrivacySettings: jest.fn(),
  };

  const mockSession = {
    getActiveSessions: jest.fn(),
    getAllSessions: jest.fn(),
    revokeSession: jest.fn(),
    revokeOtherSessions: jest.fn(),
    revokeAllSessions: jest.fn(),
  };

  const mockActivity = {
    logActivity: jest.fn(),
    getUserActivity: jest.fn(),
    getActivitySummary: jest.fn(),
    getSuspiciousActivities: jest.fn(),
  };

  const mockSearch = {
    searchUsers: jest.fn(),
    exportUsers: jest.fn(),
  };

  const mockOnboarding = {
    getOrCreate: jest.fn(),
    completeStep: jest.fn(),
    skip: jest.fn(),
    getAnalytics: jest.fn(),
  };

  const mockFileUpload = { uploadAvatar: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: UserPreferenceService, useValue: mockPref },
        { provide: UserSessionService, useValue: mockSession },
        { provide: UserActivityLogService, useValue: mockActivity },
        { provide: UserSearchService, useValue: mockSearch },
        { provide: OnboardingService, useValue: mockOnboarding },
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

  const user = { id: 'u1', email: 'e@x', firstName: 'A', lastName: 'B' } as any;

  it('returns current profile with completion', async () => {
    mockUsersService.findOne.mockResolvedValue(user);
    mockUsersService.getProfileCompletion.mockResolvedValue({ completionScore: 50 });
    const result = await controller.getCurrentProfile(user);
    expect(result.profileCompletion.completionScore).toBe(50);
  });

  it('handles profile update and avatar upload', async () => {
    mockUsersService.updateProfile.mockResolvedValue({ ...user, firstName: 'New' });
    await controller.updateProfile(user, { firstName: 'New' } as any);

    mockUsersService.updateAvatar.mockResolvedValue({ ...user, avatarUrl: 'url' });
    await controller.updateAvatar(user, { avatarUrl: 'url' });
    expect(mockActivity.logActivity).toHaveBeenCalled();
  });

  it('uploads avatar directly', async () => {
    const file = { buffer: Buffer.from(''), mimetype: 'image/png', originalname: 'a.png' } as any;
    mockFileUpload.uploadAvatar.mockResolvedValue('https://cdn/avatar.png');
    mockUsersService.updateAvatar.mockResolvedValue({ ...user, avatarUrl: 'https://cdn/avatar.png' });

    const result = await controller.uploadAvatarDirect(file, user);
    expect(result.avatarUrl).toContain('avatar.png');
  });

  it('handles preferences endpoints', async () => {
    mockPref.getPreferences.mockResolvedValue({ emailNotifications: true });
    mockPref.updatePreferences.mockResolvedValue({ ok: true });
    mockPref.getNotificationPreferences.mockResolvedValue({ push: true });
    mockPref.updateNotificationSettings.mockResolvedValue({ push: false });
    mockPref.getPrivacySettings.mockResolvedValue({ showEmail: false });
    mockPref.updatePrivacySettings.mockResolvedValue({ showEmail: true });

    await controller.getPreferences(user);
    await controller.updatePreferences(user, { activityEmails: true } as any);
    await controller.getNotificationPreferences(user);
    await controller.updateNotificationPreferences(user, { push: false });
    await controller.getPrivacySettings(user);
    await controller.updatePrivacySettings(user, { showEmail: true });

    expect(mockPref.getPreferences).toHaveBeenCalledWith('u1');
    expect(mockPref.updatePreferences).toHaveBeenCalled();
  });

  it('handles session endpoints', async () => {
    mockSession.getActiveSessions.mockResolvedValue([]);
    mockSession.getAllSessions.mockResolvedValue([]);
    mockSession.revokeSession.mockResolvedValue(undefined);
    mockSession.revokeOtherSessions.mockResolvedValue(undefined);

    await controller.getActiveSessions(user);
    await controller.getAllSessions(user);
    await controller.revokeSession(user, 's1');
    await controller.revokeOtherSessions(user, { currentSessionId: 's0' });

    expect(mockSession.revokeSession).toHaveBeenCalledWith('s1');
    expect(mockSession.revokeOtherSessions).toHaveBeenCalledWith('u1', 's0');
  });

  it('handles activity endpoints', async () => {
    mockActivity.getUserActivity.mockResolvedValue([]);
    mockActivity.getActivitySummary.mockResolvedValue({ total: 1 });
    mockActivity.getSuspiciousActivities.mockResolvedValue([]);

    await controller.getActivity(user, 10, 0);
    await controller.getActivitySummary(user);
    await controller.getSuspiciousActivities(user);

    expect(mockActivity.getUserActivity).toHaveBeenCalled();
  });

  it('handles account lifecycle endpoints', async () => {
    mockUsersService.deactivateAccount.mockResolvedValue(undefined);
    mockUsersService.reactivateAccount.mockResolvedValue(undefined);
    mockUsersService.softDeleteUser.mockResolvedValue(undefined);
    mockUsersService.findOne.mockResolvedValue(user);
    mockPref.getPreferences.mockResolvedValue({});
    mockSession.getAllSessions.mockResolvedValue([]);
    mockActivity.getUserActivity.mockResolvedValue([]);

    await controller.deactivateAccount(user);
    await controller.reactivateAccount(user);
    await controller.deleteAccount(user);
    const exported = await controller.exportUserData(user);

    expect(exported.user.id).toBe('u1');
    expect(mockSession.revokeAllSessions).toHaveBeenCalled();
  });

  it('handles onboarding endpoints', async () => {
    mockOnboarding.getOrCreate.mockResolvedValue({ currentStep: 'welcome' });
    mockOnboarding.completeStep.mockResolvedValue({ progressPercent: 20 });
    mockOnboarding.skip.mockResolvedValue(undefined);
    mockOnboarding.getAnalytics.mockResolvedValue({ totalStarted: 1 });

    await controller.getOnboardingStatus(user);
    await controller.completeOnboardingStep(user, 'welcome' as any);
    await controller.skipOnboarding(user);
    await controller.getOnboardingAnalytics();

    expect(mockOnboarding.completeStep).toHaveBeenCalledWith('u1', 'welcome');
  });

  it('handles admin/user CRUD and search/export endpoints', async () => {
    mockUsersService.create.mockResolvedValue({ id: 'u2' });
    mockUsersService.findAll.mockResolvedValue([{ id: 'u1' }]);
    mockUsersService.findOne.mockResolvedValue({ id: 'u1' });
    mockUsersService.update.mockResolvedValue({ id: 'u1', firstName: 'C' });
    mockUsersService.remove.mockResolvedValue(undefined);
    mockUsersService.getPublicProfile.mockResolvedValue({ id: 'u2' });
    mockSearch.searchUsers.mockResolvedValue({ data: [] });
    mockSearch.exportUsers.mockResolvedValue('id,email\nu1,e@x');

    await controller.create({ email: 'n@x', firstName: 'N', lastName: 'X' } as any);
    await controller.findAll();
    await controller.searchUsers({ q: 'john' } as any);
    await controller.exportUsers({ q: 'john' } as any);
    await controller.getUserProfile('u2');
    await controller.getMe(user);
    await controller.findOne('u1');
    await controller.update('u1', { firstName: 'C' } as any);
    await controller.remove('u1');

    expect(mockUsersService.create).toHaveBeenCalled();
    expect(mockSearch.searchUsers).toHaveBeenCalled();
    expect(mockUsersService.remove).toHaveBeenCalledWith('u1');
  });
});
