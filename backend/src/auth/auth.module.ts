import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersModule } from '../modules/users/users.module';
import { User } from '../modules/users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Session } from './entities/session.entity';
import { EmailServiceImpl } from './services/email.service';
import { EmailService } from './interfaces/email-service.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, Session]),
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
    {
      provide: EmailService,
      useClass: EmailServiceImpl,
    },
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
