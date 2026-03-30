import {
  Module,
  forwardRef,
  NestModule,
  MiddlewareConsumer,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesController } from './controllers/roles.controller';
import { RoleValidationMiddleware } from './middlewares/role-validation.middleware';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { AppleStrategy } from './strategies/apple.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { UsersModule } from '../modules/users/users.module';
import { User } from '../modules/users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Session } from './entities/session.entity';
import { Role } from './entities/role.entity';
import { PermissionEntity } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { RoleAuditLog } from './entities/role-audit-log.entity';
import { FailedLoginAttempt } from './entities/failed-login-attempt.entity';
import { LoginHistory } from './entities/login-history.entity';
import { AuthSecurityEvent } from './entities/auth-security-event.entity';
import { EmailNotificationService } from './services/email-notification.service';
import { SessionService } from './services/session.service';
import { PasswordResetService } from './services/password-reset.service';
import { LoginAttemptService } from './services/login-attempt.service';
import { EMAIL_SERVICE } from './interfaces/email-service.interface';
import { RolesService } from './services/roles.service';
import { PermissionsService } from './services/permissions.service';
import { RolesPermissionsSeeder } from './seeds/roles-permissions.seed';
import { RedisService } from './services/redis.service';
import { OAuthService } from './services/oauth.service';
import { SmsModule } from '../modules/sms/sms.module';
import { EmailModule } from '../modules/email/email.module';
import { EmailService as AppEmailService } from '../modules/email/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      Session,
      Role,
      PermissionEntity,
      UserRole,
      RolePermission,
      RoleAuditLog,
      FailedLoginAttempt,
      LoginHistory,
      AuthSecurityEvent,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('auth.jwtSecret') || 'fallback-secret';
        const expiresIn =
          configService.get<string>('auth.jwtAccessExpiration') || '15m';
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        let expiresInSeconds = 900;
        if (match) {
          const value = parseInt(match[1], 10);
          const unit = match[2];
          switch (unit) {
            case 's':
              expiresInSeconds = value;
              break;
            case 'm':
              expiresInSeconds = value * 60;
              break;
            case 'h':
              expiresInSeconds = value * 3600;
              break;
            case 'd':
              expiresInSeconds = value * 86400;
              break;
          }
        }
        return {
          secret,
          signOptions: { expiresIn: expiresInSeconds },
        };
      },
    }),
    forwardRef(() => UsersModule),
    SmsModule,
    EmailModule,
  ],
  controllers: [AuthController, RolesController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    AppleStrategy,
    JwtAuthGuard,
    RolesGuard,
    RolesService,
    PermissionsService,
    RolesPermissionsSeeder,
    EmailNotificationService,
    SessionService,
    PasswordResetService,
    LoginAttemptService,
    {
      provide: EMAIL_SERVICE,
      useExisting: AppEmailService,
    },
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    RolesService,
    PermissionsService,
    OAuthService,
  ],
})
export class AuthModule {}
