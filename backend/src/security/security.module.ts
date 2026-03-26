import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { SecurityEvent } from './entities/security-event.entity';
import { BlacklistedIp } from './entities/blacklisted-ip.entity';
import { ApiKey } from './entities/api-key.entity';
import { ThreatDetectionService } from './services/threat-detection.service';
import { IpBlacklistService } from './services/ip-blacklist.service';
import { SecurityAuditService } from './services/security-audit.service';
import { AlertService } from './services/alert.service';
import { IncidentResponseService } from './services/incident-response.service';
import { SecurityMonitoringService } from './services/security-monitoring.service';
import { SecurityController } from './security.controller';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { IpBlacklistGuard } from './guards/ip-blacklist.guard';
import { DdosProtectionGuard } from './guards/ddos-protection.guard';
import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
import { SqlInjectionDetectionMiddleware } from './middleware/sql-injection-detection.middleware';
import { XssProtectionMiddleware } from './middleware/xss-protection.middleware';
import { SecurityExceptionFilter } from './filters/security-exception.filter';

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
import { AlertService } from './services/alert.service';
import { IncidentResponseService } from './services/incident-response.service';
import { SecurityMonitoringService } from './services/security-monitoring.service';
import { SecurityController } from './security.controller';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { IpBlacklistGuard } from './guards/ip-blacklist.guard';
import { DdosProtectionGuard } from './guards/ddos-protection.guard';
import { ApiKeyGuard } from './guards/api-key.guard';
import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
import { SqlInjectionDetectionMiddleware } from './middleware/sql-injection-detection.middleware';
import { XssProtectionMiddleware } from './middleware/xss-protection.middleware';
import { SecurityExceptionFilter } from './filters/security-exception.filter';
import { ApiKeyController } from './controllers/api-key.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecurityEvent, BlacklistedIp, ApiKey]),
    CacheModule.register({
      ttl: 300000,
      max: 10000,
    }),
    // @nestjs/throttler — global rate limiting (100 req / 60s default)
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,   // 1 minute window (ms)
        limit: 100,
      },
      {
        name: 'strict',
        ttl: 60000,
        limit: 10,
      },
    ]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
  ],
  controllers: [SecurityController],
  providers: [
    ThreatDetectionService,
    IpBlacklistService,
    SecurityAuditService,
    AlertService,
    IncidentResponseService,
    SecurityMonitoringService,
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
  exports: [ThreatDetectionService, IpBlacklistService, SecurityAuditService, AlertService, IncidentResponseService, SecurityMonitoringService],
})
export class IntrusionDetectionModule implements NestModule {
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
