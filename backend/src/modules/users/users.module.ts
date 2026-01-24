import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UploadsController } from './uploads.controller';
import { User } from './entities/user.entity';
import { UserPreference } from './entities/user-preference.entity';
import { UserSession } from './entities/user-session.entity';
import { UserActivityLog } from './entities/user-activity-log.entity';
import { UserPreferenceService } from './services/user-preference.service';
import { UserSessionService } from './services/user-session.service';
import { UserActivityLogService } from './services/user-activity-log.service';
import { FileUploadService } from './services/file-upload.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserPreference,
      UserSession,
      UserActivityLog,
    ]),
  ],
  controllers: [UsersController, UploadsController],
  providers: [
    UsersService,
    UserPreferenceService,
    UserSessionService,
    UserActivityLogService,
    FileUploadService,
  ],
  exports: [
    UsersService,
    UserPreferenceService,
    UserSessionService,
    UserActivityLogService,
    FileUploadService,
  ],
})
export class UsersModule {}
