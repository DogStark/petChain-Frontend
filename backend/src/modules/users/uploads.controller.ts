import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from './services/file-upload.service';
import { UsersService } from './users.service';
import { UserActivityLogService } from './services/user-activity-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly usersService: UsersService,
    private readonly activityLogService: UserActivityLogService,
  ) {}

  /**
   * Upload avatar
   * POST /uploads/avatar
   */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    const avatarUrl = await this.fileUploadService.uploadAvatar(
      file,
      user.id,
    );

    // Update user profile with new avatar
    const updated = await this.usersService.updateAvatar(user.id, avatarUrl);

    // Log activity
    await this.activityLogService.logActivity({
      userId: user.id,
      activityType: 'AVATAR_UPLOAD' as any,
      description: 'Avatar uploaded successfully',
      metadata: { avatarUrl },
    });

    return {
      message: 'Avatar uploaded successfully',
      avatarUrl,
      user: updated,
    };
  }
}
