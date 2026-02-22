import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
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
import { EmailServiceImpl } from './services/email.service';
import { EMAIL_SERVICE } from './interfaces/email-service.interface';
import { RolesService } from './services/roles.service';
import { RolesController } from './controllers/roles.controller';
import { PermissionsService } from './services/permissions.service';
import { RolesPermissionsSeeder } from './seeds/roles-permissions.seed';

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
        // Parse duration to seconds
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        let expiresInSeconds = 900; // Default 15 minutes
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
          signOptions: {
            expiresIn: expiresInSeconds,
          },
        };
      },
    }),
    forwardRef(() => UsersModule),
  ],
  controllers: [AuthController, RolesController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    RolesService,
    PermissionsService,
    RolesPermissionsSeeder,
    {
      provide: EMAIL_SERVICE,
      useClass: EmailServiceImpl,
    },
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    RolesService,
    PermissionsService,
  ],
})
export class AuthModule {}
