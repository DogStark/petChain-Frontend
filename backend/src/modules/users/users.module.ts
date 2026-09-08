import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UploadsController } from './uploads.controller';
import { User } from './entities/user.entity';
import { UserPreference } from './entities/user-preference.entity';
import { UserSession } from './entities/user-session.entity';
import { UserActivityLog } from './entities/user-activity-log.entity';
import { UserOnboarding } from './entities/user-onboarding.entity';
import { UserPreferenceService } from './services/user-preference.service';
import { UserSessionService } from './services/user-session.service';
import { UserActivityLogService } from './services/user-activity-log.service';
import { FileUploadService } from './services/file-upload.service';
import { OnboardingService } from './services/onboarding.service';
import { UserSearchService } from './services/user-search.service';
import { RedisService } from '../../auth/services/redis.service';
import { AuthModule } from '../../auth/auth.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserPreference,
      UserSession,
      UserActivityLog,
      UserOnboarding,
    ]),
    forwardRef(() => AuthModule),
    SmsModule,
  ],
  controllers: [UsersController, UploadsController],
  providers: [
    UsersService,
    UserPreferenceService,
    UserSessionService,
    UserActivityLogService,
    FileUploadService,
    OnboardingService,
    UserSearchService,
    RedisService,
  ],
  exports: [
    UsersService,
    UserPreferenceService,
    UserSessionService,
    UserActivityLogService,
    FileUploadService,
    OnboardingService,
    UserSearchService,
  ],
})
export class UsersModule {}
