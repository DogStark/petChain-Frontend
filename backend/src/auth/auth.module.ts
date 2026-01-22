import { Module } from '@nestjs/common';
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
import { EmailService } from './interfaces/email-service.interface';
import { RolesService } from './services/roles.service';
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
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwtSecret'),
        signOptions: {
          expiresIn: configService.get<string>('auth.jwtAccessExpiration') || '15m',
        },
      }),
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    RolesService,
    PermissionsService,
    RolesPermissionsSeeder,
    {
      provide: EmailService,
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
