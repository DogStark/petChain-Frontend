import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import * as crypto from 'crypto';

import { EmailLog, EmailStatus, EmailType } from './entities/email-log.entity';
import { EmailUnsubscribe } from './entities/email-unsubscribe.entity';
import {
    EmailPreference,
    EMAIL_TYPE_TO_PREFERENCE,
} from './entities/email-preference.entity';
import { SendEmailDto } from './dto/send-email.dto';
import {
    vaccinationReminderTemplate,
    appointmentConfirmationTemplate,
    medicalRecordUpdateTemplate,
    lostPetAlertTemplate,
    systemNotificationTemplate,
} from './templates/email-templates';
import { baseTemplate, emailButton } from './templates/base.template';

@Injectable()
export class EmailService implements OnModuleInit {
    private readonly logger = new Logger(EmailService.name);
    private processorInterval: NodeJS.Timeout | null = null;

    constructor(
        @InjectRepository(EmailLog)
        private readonly emailLogRepo: Repository<EmailLog>,
        @InjectRepository(EmailPreference)
        private readonly preferenceRepo: Repository<EmailPreference>,
        @InjectRepository(EmailUnsubscribe)
        private readonly unsubscribeRepo: Repository<EmailUnsubscribe>,
        private readonly configService: ConfigService,
    ) { }

    onModuleInit() {
        const apiKey = this.configService.get<string>('email.sendgridApiKey');
        if (apiKey) {
            sgMail.setApiKey(apiKey);
            this.logger.log('SendGrid initialised');
        } else {
            this.logger.warn('SENDGRID_API_KEY not set — emails will be logged only');
        }

        // Start queue processor
        const intervalMs =
            (this.configService.get<number>('email.queue.intervalSeconds') ?? 30) *
            1000;
        this.processorInterval = setInterval(() => {
            this.processQueue().catch((err) =>
                this.logger.error('Queue processing error:', err),
            );
        }, intervalMs);
        this.logger.log(
            `Email queue processor started (every ${intervalMs / 1000}s)`,
        );
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Queue an email for sending.
     * Checks user preferences and unsubscribe status before queuing.
     */
    async queueEmail(dto: SendEmailDto): Promise<EmailLog> {
        // Check unsubscribe status
        if (await this.isUnsubscribed(dto.recipientEmail, dto.type)) {
            this.logger.log(
                `Skipping email to ${dto.recipientEmail} — unsubscribed from ${dto.type}`,
            );
            const log = this.emailLogRepo.create({
                recipientEmail: dto.recipientEmail,
                recipientUserId: dto.recipientUserId ?? null,
                type: dto.type,
                subject: 'SKIPPED',
                htmlBody: '',
                status: EmailStatus.UNSUBSCRIBED,
                metadata: dto.metadata ?? null,
            });
            return this.emailLogRepo.save(log);
        }

        // Check per-user preferences (only for users we know about)
        if (dto.recipientUserId) {
            const allowed = await this.isEmailTypeAllowed(
                dto.recipientUserId,
                dto.type,
            );
            if (!allowed) {
                this.logger.log(
                    `Skipping email to ${dto.recipientEmail} — preference disabled for ${dto.type}`,
                );
                const log = this.emailLogRepo.create({
                    recipientEmail: dto.recipientEmail,
                    recipientUserId: dto.recipientUserId,
                    type: dto.type,
                    subject: 'SKIPPED',
                    htmlBody: '',
                    status: EmailStatus.UNSUBSCRIBED,
                    metadata: dto.metadata ?? null,
                });
                return this.emailLogRepo.save(log);
            }
        }

        // Build unsubscribe URL
        const unsubscribeToken = await this.createUnsubscribeToken(
            dto.recipientEmail,
            dto.recipientUserId ?? null,
            dto.type,
        );
        const baseUrl = this.configService.get<string>('email.appBaseUrl');
        const unsubscribeUrl = `${baseUrl}/email/unsubscribe?token=${unsubscribeToken}`;

        // Render template
        const { subject, html, text } = this.renderTemplate(dto, unsubscribeUrl);

        const maxAttempts =
            this.configService.get<number>('email.queue.maxAttempts') ?? 3;

        const log = this.emailLogRepo.create({
            recipientEmail: dto.recipientEmail,
            recipientUserId: dto.recipientUserId ?? null,
            type: dto.type,
            subject,
            htmlBody: html,
            textBody: text,
            status: EmailStatus.QUEUED,
            maxAttempts,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : new Date(),
            metadata: dto.metadata ?? null,
        });

        await this.emailLogRepo.save(log);
        this.logger.log(
            `Queued email [${dto.type}] to ${dto.recipientEmail} (id: ${log.id})`,
        );
        return log;
    }

    /**
     * Process the queue — called on interval by the scheduler.
     * Picks up QUEUED emails whose scheduledAt <= now and sends them.
     */
    async processQueue(): Promise<void> {
        const batchSize =
            this.configService.get<number>('email.queue.batchSize') ?? 10;

        const pending = await this.emailLogRepo.find({
            where: {
                status: In([EmailStatus.QUEUED, EmailStatus.PENDING]),
                scheduledAt: LessThanOrEqual(new Date()),
            },
            order: { scheduledAt: 'ASC' },
            take: batchSize,
        });

        if (pending.length === 0) return;

        this.logger.log(`Processing ${pending.length} queued email(s)`);

        for (const log of pending) {
            await this.sendLog(log);
        }
    }

    /**
     * Handle SendGrid inbound webhook events (delivered, bounce, etc.)
     */
    async handleSendGridWebhook(events: SendGridWebhookEvent[]): Promise<void> {
        for (const event of events) {
            if (!event.sg_message_id) continue;

            const messageId = event.sg_message_id.split('.')[0];
            const log = await this.emailLogRepo.findOne({
                where: { providerMessageId: messageId },
            });

            if (!log) continue;

            switch (event.event) {
                case 'delivered':
                    log.status = EmailStatus.DELIVERED;
                    log.deliveredAt = new Date(event.timestamp * 1000);
                    break;
                case 'bounce':
                case 'blocked':
                    log.status = EmailStatus.BOUNCED;
                    log.errorMessage = event.reason ?? 'Bounced';
                    break;
                case 'unsubscribe':
                case 'group_unsubscribe':
                    log.status = EmailStatus.UNSUBSCRIBED;
                    await this.globalUnsubscribe(log.recipientEmail);
                    break;
            }

            await this.emailLogRepo.save(log);
        }
    }

    // Convenience methods so callers don't need to build DTOs manually

    async sendVerificationEmail(
        email: string,
        token: string,
        name?: string,
    ): Promise<EmailLog> {
        return this.queueEmail({
            recipientEmail: email,
            type: EmailType.VERIFICATION,
            data: { email, token, name },
        } as any);
    }

    async sendPasswordResetEmail(
        email: string,
        token: string,
        name?: string,
    ): Promise<EmailLog> {
        return this.queueEmail({
            recipientEmail: email,
            type: EmailType.PASSWORD_RESET,
            data: { email, token, name },
        } as any);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private async sendLog(log: EmailLog): Promise<void> {
        log.attemptCount += 1;
        log.status = EmailStatus.PENDING;
        await this.emailLogRepo.save(log);

        try {
            const apiKey = this.configService.get<string>('email.sendgridApiKey');
            const fromEmail =
                this.configService.get<string>('email.fromEmail') ??
                'noreply@petcare.app';
            const fromName =
                this.configService.get<string>('email.fromName') ?? 'PetCare';

            if (!apiKey) {
                // Dev mode — log instead of sending
                this.logger.debug(
                    `[DEV] Would send email to ${log.recipientEmail}: ${log.subject}`,
                );
                log.status = EmailStatus.SENT;
                log.sentAt = new Date();
                await this.emailLogRepo.save(log);
                return;
            }

            const [response] = await sgMail.send({
                to: log.recipientEmail,
                from: { email: fromEmail, name: fromName },
                subject: log.subject,
                html: log.htmlBody,
                text: log.textBody ?? undefined,
                trackingSettings: {
                    clickTracking: { enable: true },
                    openTracking: { enable: true },
                },
            });

            log.status = EmailStatus.SENT;
            log.sentAt = new Date();
            log.providerMessageId =
                (response.headers as Record<string, string>)['x-message-id'] ?? null;

            this.logger.log(
                `Sent email [${log.type}] to ${log.recipientEmail} (msg: ${log.providerMessageId})`,
            );
        } catch (error: any) {
            log.errorMessage = error?.message ?? 'Unknown error';

            if (log.attemptCount >= log.maxAttempts) {
                log.status = EmailStatus.FAILED;
                this.logger.error(
                    `Email ${log.id} permanently failed after ${log.attemptCount} attempts: ${log.errorMessage}`,
                );
            } else {
                // Exponential backoff: 60s, 180s, 540s...
                const baseDelay =
                    this.configService.get<number>('email.queue.retryBaseDelaySeconds') ??
                    60;
                const multiplier =
                    this.configService.get<number>(
                        'email.queue.retryBackoffMultiplier',
                    ) ?? 3;
                const delaySeconds =
                    baseDelay * Math.pow(multiplier, log.attemptCount - 1);
                log.status = EmailStatus.QUEUED;
                log.nextRetryAt = new Date(Date.now() + delaySeconds * 1000);
                log.scheduledAt = log.nextRetryAt;
                this.logger.warn(
                    `Email ${log.id} failed (attempt ${log.attemptCount}/${log.maxAttempts}), retry in ${delaySeconds}s`,
                );
            }
        }

        await this.emailLogRepo.save(log);
    }

    private renderTemplate(
        dto: SendEmailDto,
        unsubscribeUrl: string,
    ): { subject: string; html: string; text: string } {
        const baseUrl = this.configService.get<string>('email.appBaseUrl');

        switch (dto.type) {
            case EmailType.VACCINATION_REMINDER:
                return vaccinationReminderTemplate({ ...dto.data, unsubscribeUrl });

            case EmailType.APPOINTMENT_CONFIRMATION:
                return appointmentConfirmationTemplate({ ...dto.data, unsubscribeUrl });

            case EmailType.MEDICAL_RECORD_UPDATE:
                return medicalRecordUpdateTemplate({ ...dto.data, unsubscribeUrl });

            case EmailType.LOST_PET_ALERT:
                return lostPetAlertTemplate({ ...dto.data, unsubscribeUrl });

            case EmailType.SYSTEM_NOTIFICATION:
                return systemNotificationTemplate({ ...dto.data, unsubscribeUrl });

            case EmailType.VERIFICATION: {
                const { email, token, name } = (dto as any).data;
                const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
                const subject = 'Verify your PetCare email address';
                const body = `
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Verify your email ✉️</h1>
          <p>Hi ${name ?? email},</p>
          <p>Click the button below to verify your email address and activate your PetCare account.</p>
          ${emailButton('Verify Email Address', verifyUrl)}
          <p style="color:#6b7280;font-size:13px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
        `;
                return {
                    subject,
                    html: baseTemplate(body, {
                        previewText: 'Verify your PetCare account',
                    }),
                    text: `Verify your email: ${verifyUrl}`,
                };
            }

            case EmailType.PASSWORD_RESET: {
                const { email, token, name } = (dto as any).data;
                const resetUrl = `${baseUrl}/reset-password?token=${token}`;
                const subject = 'Reset your PetCare password';
                const body = `
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Reset your password 🔑</h1>
          <p>Hi ${name ?? email},</p>
          <p>We received a request to reset your password. Click the button below to choose a new one.</p>
          ${emailButton('Reset Password', resetUrl, '#dc2626')}
          <p style="color:#6b7280;font-size:13px;">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
        `;
                return {
                    subject,
                    html: baseTemplate(body, {
                        previewText: 'Reset your PetCare password',
                    }),
                    text: `Reset your password: ${resetUrl}`,
                };
            }

            default:
                throw new Error(
                    `No template registered for email type: ${(dto as any).type}`,
                );
        }
    }

    private async isUnsubscribed(
        email: string,
        type: EmailType,
    ): Promise<boolean> {
        const existing = await this.unsubscribeRepo.findOne({
            where: [
                { email, emailType: null, used: true }, // global unsubscribe
                { email, emailType: type, used: true }, // type-specific
            ],
        });
        return Boolean(existing);
    }

    private async isEmailTypeAllowed(
        userId: string,
        type: EmailType,
    ): Promise<boolean> {
        const pref = await this.preferenceRepo.findOne({ where: { userId } });
        if (!pref) return true; // no record = all allowed by default

        if (!pref.globalOptIn) return false;

        const prefKey = EMAIL_TYPE_TO_PREFERENCE[type];
        if (!prefKey) return true; // transactional emails (verification, reset) always send

        return Boolean(pref[prefKey]);
    }

    private async createUnsubscribeToken(
        email: string,
        userId: string | null,
        type: EmailType,
    ): Promise<string> {
        const token = crypto.randomBytes(32).toString('hex');
        const record = this.unsubscribeRepo.create({
            token,
            email,
            userId,
            emailType: type,
            used: false,
        });
        await this.unsubscribeRepo.save(record);
        return token;
    }

    private async globalUnsubscribe(email: string): Promise<void> {
        const token = crypto.randomBytes(32).toString('hex');
        const record = this.unsubscribeRepo.create({
            token,
            email,
            userId: null,
            emailType: null,
            used: true,
            usedAt: new Date(),
        });
        await this.unsubscribeRepo.save(record);
        this.logger.log(`Global unsubscribe recorded for ${email}`);
    }
}

// SendGrid webhook event shape (partial)
interface SendGridWebhookEvent {
    event: string;
    sg_message_id?: string;
    timestamp: number;
    reason?: string;
}
