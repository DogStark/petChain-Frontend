import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { SecurityEvent } from './entities/security-event.entity';
import { BlacklistedIp } from './entities/blacklisted-ip.entity';
import { ThreatDetectionService } from './services/threat-detection.service';
import { IpBlacklistService } from './services/ip-blacklist.service';
import { SecurityAuditService } from './services/security-audit.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { IpBlacklistGuard } from './guards/ip-blacklist.guard';
import { DdosProtectionGuard } from './guards/ddos-protection.guard';
import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
import { SqlInjectionDetectionMiddleware } from './middleware/sql-injection-detection.middleware';
import { XssProtectionMiddleware } from './middleware/xss-protection.middleware';
import { SecurityExceptionFilter } from './filters/security-exception.filter';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityEvent, BlacklistedIp]),
    CacheModule.register({
      ttl: 300000,
      max: 10000,
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
  ],
  providers: [
    ThreatDetectionService,
    IpBlacklistService,
    SecurityAuditService,
    {
      provide: APP_GUARD,
      useClass: IpBlacklistGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DdosProtectionGuard,
    },
    {
      provide: APP_FILTER,
      useClass: SecurityExceptionFilter,
    },
  ],
  exports: [ThreatDetectionService, IpBlacklistService, SecurityAuditService],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        SecurityHeadersMiddleware,
        SqlInjectionDetectionMiddleware,
        XssProtectionMiddleware,
      )
      .forRoutes('*');
  }
}
