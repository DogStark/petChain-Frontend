import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { FilesModule } from '../files/files.module';
import { WsAuthGuard } from '../../websocket/guards/ws-auth.guard';

@Global() // Make global to avoid imports everywhere
@Module({
  imports: [
    FilesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwtSecret') || 'fallback-secret',
      }),
    }),
  ],
  providers: [RealtimeGateway, WsAuthGuard],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
