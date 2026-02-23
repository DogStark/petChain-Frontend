import { registerAs } from '@nestjs/config';

export const smsConfig = registerAs('sms', () => ({
  enabled: process.env.SMS_ENABLED === 'true',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  webhookUrl: process.env.SMS_WEBHOOK_URL || '',
  monthlyLimitCents: parseInt(process.env.SMS_MONTHLY_LIMIT_CENTS || '5000', 10),
  defaultSpendingLimitCents: parseInt(
    process.env.SMS_DEFAULT_SPENDING_LIMIT_CENTS || '1000',
    10,
  ),
}));
