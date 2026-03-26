import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SecurityMonitoringService, SecurityMetrics, RealTimeAlert } from './services/security-monitoring.service';
import { ThreatDetectionService } from './services/threat-detection.service';
import { IpBlacklistService } from './services/ip-blacklist.service';
import { AlertService } from './services/alert.service';
import { IncidentResponseService } from './services/incident-response.service';
import { SecurityEvent, SecurityEventType, SecuritySeverity } from './entities/security-event.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Security')
@Controller('security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SecurityController {
  constructor(
    private securityMonitoringService: SecurityMonitoringService,
    private threatDetectionService: ThreatDetectionService,
    private ipBlacklistService: IpBlacklistService,
    private alertService: AlertService,
    private incidentResponseService: IncidentResponseService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get security metrics' })
  @ApiResponse({ status: 200, description: 'Security metrics retrieved successfully' })
  async getSecurityMetrics(@Query('timeRange') timeRange: '1h' | '24h' | '7d' = '24h'): Promise<SecurityMetrics> {
    return this.securityMonitoringService.getSecurityMetrics(timeRange);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get active security alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts retrieved successfully' })
  async getActiveAlerts(): Promise<RealTimeAlert[]> {
    return this.securityMonitoringService.getActiveAlerts();
  }

  @Post('alerts/:alertId/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge a security alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged successfully' })
  async acknowledgeAlert(@Param('alertId') alertId: string): Promise<{ success: boolean }> {
    const success = await this.securityMonitoringService.acknowledgeAlert(alertId);
    return { success };
  }

  @Get('events')
  @ApiOperation({ summary: 'Get security events with filtering' })
  @ApiResponse({ status: 200, description: 'Security events retrieved successfully' })
  async getSecurityEvents(
    @Query() filters: {
      ipAddress?: string;
      type?: SecurityEventType;
      severity?: SecuritySeverity;
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
  ): Promise<SecurityEvent[]> {
    const parsedFilters = {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      limit: filters.limit ? parseInt(filters.limit.toString()) : undefined,
    };

    return this.threatDetectionService.getSecurityEvents(parsedFilters);
  }

  @Get('threat-intelligence')
  @ApiOperation({ summary: 'Get threat intelligence data' })
  @ApiResponse({ status: 200, description: 'Threat intelligence retrieved successfully' })
  async getThreatIntelligence() {
    return this.securityMonitoringService.getThreatIntelligence();
  }

  @Post('blacklist/:ipAddress')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Manually blacklist an IP address' })
  @ApiResponse({ status: 201, description: 'IP address blacklisted successfully' })
  async blacklistIp(
    @Param('ipAddress') ipAddress: string,
    @Body() body: { reason: string; durationMinutes?: number },
  ) {
    const result = await this.ipBlacklistService.blacklistIp(
      ipAddress,
      body.reason,
      100, // Manual blacklist gets high threat score
      body.durationMinutes,
    );
    return result;
  }

  @Post('blacklist/:ipAddress/remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove IP address from blacklist' })
  @ApiResponse({ status: 200, description: 'IP address removed from blacklist successfully' })
  async removeFromBlacklist(@Param('ipAddress') ipAddress: string): Promise<void> {
    await this.ipBlacklistService.removeFromBlacklist(ipAddress);
  }

  @Get('blacklist')
  @ApiOperation({ summary: 'Get all blacklisted IP addresses' })
  @ApiResponse({ status: 200, description: 'Blacklisted IPs retrieved successfully' })
  async getBlacklistedIps() {
    // This would need to be implemented in IpBlacklistService
    return { message: 'Not implemented yet' };
  }

  @Get('response-rules')
  @ApiOperation({ summary: 'Get incident response rules' })
  @ApiResponse({ status: 200, description: 'Response rules retrieved successfully' })
  async getResponseRules() {
    return this.incidentResponseService.getResponseRules();
  }

  @Get('alert-rules')
  @ApiOperation({ summary: 'Get alert configuration rules' })
  @ApiResponse({ status: 200, description: 'Alert rules retrieved successfully' })
  async getAlertRules() {
    return this.alertService.getAlertRules();
  }

  @Post('test-threat-detection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test threat detection with sample request' })
  @ApiResponse({ status: 200, description: 'Threat detection test completed' })
  async testThreatDetection(@Body() testRequest: any) {
    const analysis = await this.threatDetectionService.analyzeRequest(testRequest);
    return {
      analysis,
      message: 'Threat detection test completed',
    };
  }
}