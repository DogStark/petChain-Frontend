import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import twilio from 'twilio';
import { SmsLog, SmsStatus } from './entities/sms-log.entity';
import { SmsCostService } from './sms-cost.service';

export interface SendSmsOptions {
  templateId?: string;
  templateName?: string;
  skipPreferenceCheck?: boolean;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: twilio.Twilio | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SmsLog)
    private readonly smsLogRepository: Repository<SmsLog>,
    private readonly smsCostService: SmsCostService,
  ) {
    const accountSid = this.configService.get<string>('sms.twilioAccountSid');
    const authToken = this.configService.get<string>('sms.twilioAuthToken');
    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
    }
  }

  isEnabled(): boolean {
    return this.configService.get<boolean>('sms.enabled') === true && !!this.twilioClient;
  }

  async sendSms(
    userId: string,
    phoneNumber: string,
    message: string,
    options: SendSmsOptions = {},
  ): Promise<{ success: boolean; logId?: string; error?: string }> {
    if (!this.isEnabled()) {
      this.logger.warn('SMS is disabled or Twilio not configured. Skipping send.');
      return { success: false, error: 'SMS_NOT_ENABLED' };
    }

    const canSend = await this.smsCostService.canSendSms(userId);
    if (!canSend.allowed) {
      return { success: false, error: canSend.reason ?? 'LIMIT_REACHED' };
    }

    const fromNumber = this.configService.get<string>('sms.twilioPhoneNumber');
    const webhookUrl = this.configService.get<string>('sms.webhookUrl');

    if (!fromNumber) {
      this.logger.warn('Twilio from number not configured.');
      return { success: false, error: 'TWILIO_NOT_CONFIGURED' };
    }

    const log = this.smsLogRepository.create({
      userId,
      phoneNumber,
      templateId: options.templateId ?? undefined,
      message,
      status: SmsStatus.PENDING,
      costInCents: '0',
      segments: 1,
    });
    await this.smsLogRepository.save(log);

    try {
      const twilioParams: {
        body: string;
        from: string;
        to: string;
        statusCallback?: string;
      } = {
        body: message,
        from: fromNumber,
        to: this.normalizePhoneNumber(phoneNumber),
      };
      if (webhookUrl) {
        twilioParams.statusCallback = webhookUrl;
      }

      const result = await this.twilioClient!.messages.create(twilioParams);

      log.status = SmsStatus.SENT;
      log.twilioSid = result.sid;
      if (result.numSegments) {
        log.segments = parseInt(String(result.numSegments), 10) || 1;
      }
      await this.smsLogRepository.save(log);

      const estimatedCents = 0.0075 * (log.segments || 1);
      await this.smsCostService.recordSend(log.userId, log.id, estimatedCents);

      this.logger.log(`SMS sent to ${phoneNumber}, sid: ${result.sid}`);
      return { success: true, logId: log.id };
    } catch (err: any) {
      log.status = SmsStatus.FAILED;
      log.errorCode = err?.code?.toString?.() ?? undefined;
      log.errorMessage = err?.message ?? 'Unknown error';
      await this.smsLogRepository.save(log);
      this.logger.error(`SMS failed to ${phoneNumber}: ${err?.message}`);
      return {
        success: false,
        logId: log.id,
        error: err?.message ?? 'SEND_FAILED',
      };
    }
  }

  async updateDeliveryStatus(
    twilioSid: string,
    status: string,
    errorCode?: string,
    errorMessage?: string,
    costCents?: number,
  ): Promise<SmsLog | null> {
    const log = await this.smsLogRepository.findOne({ where: { twilioSid } });
    if (!log) return null;

    const previousStatus = log.status;
    const mappedStatus = this.mapTwilioStatus(status);
    log.status = mappedStatus;
    if (errorCode) log.errorCode = errorCode;
    if (errorMessage) log.errorMessage = errorMessage;
    if (costCents !== undefined) log.costInCents = String(costCents);
    if (mappedStatus === SmsStatus.DELIVERED) {
      log.deliveredAt = new Date();
    }
    if (mappedStatus === SmsStatus.FAILED && errorMessage) {
      log.errorMessage = errorMessage;
    }
    await this.smsLogRepository.save(log);

    if (mappedStatus !== previousStatus) {
      await this.smsCostService.recordDeliveryUpdate(log, mappedStatus, costCents);
    }
    return log;
  }

  async getLogByTwilioSid(twilioSid: string): Promise<SmsLog | null> {
    return this.smsLogRepository.findOne({ where: { twilioSid } });
  }

  private mapTwilioStatus(twilioStatus: string): SmsStatus {
    switch (twilioStatus?.toUpperCase()) {
      case 'DELIVERED':
        return SmsStatus.DELIVERED;
      case 'SENT':
      case 'QUEUED':
      case 'SENDING':
        return SmsStatus.SENT;
      case 'FAILED':
      case 'UNDELIVERED':
        return SmsStatus.FAILED;
      default:
        return SmsStatus.SENT;
    }
  }

  private normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10 && phone.startsWith('+') === false) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    return phone.startsWith('+') ? phone : `+${digits}`;
  }
}
