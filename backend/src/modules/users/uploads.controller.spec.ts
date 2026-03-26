import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { FileUploadService } from './services/file-upload.service';
import { UsersService } from './users.service';
import { UserActivityLogService } from './services/user-activity-log.service';

jest.mock('../../auth/guards/jwt-auth.guard');

describe('UploadsController', () => {
  let controller: UploadsController;
  const mockFileService = { uploadAvatar: jest.fn() };
  const mockUserService = { updateAvatar: jest.fn() };
  const mockActivity = { logActivity: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        { provide: FileUploadService, useValue: mockFileService },
        { provide: UsersService, useValue: mockUserService },
        { provide: UserActivityLogService, useValue: mockActivity },
      ],
    })
      .overrideGuard('JwtAuthGuard')
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UploadsController>(UploadsController);
    jest.clearAllMocks();
  });

  it('should upload avatar and update user', async () => {
    const file = { buffer: Buffer.from(''), mimetype: 'image/png', originalname: 'pic.png' } as any;
    const user = { id: 'u1' } as any;
    mockFileService.uploadAvatar.mockResolvedValue('/path/url');
    mockUserService.updateAvatar.mockResolvedValue({ ...user, avatarUrl: '/path/url' });

    const result = await controller.uploadAvatar(file, user);
    expect(mockFileService.uploadAvatar).toHaveBeenCalledWith(file, 'u1');
    expect(mockUserService.updateAvatar).toHaveBeenCalledWith('u1', '/path/url');
    expect(result.user.avatarUrl).toBe('/path/url');
    expect(result.message).toMatch(/success/i);
  });
});
