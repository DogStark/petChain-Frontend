import {
    Controller,
    Get,
    Post,
    Query,
    Body,
    Param,
    Patch,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { EmailService } from './email.service';
import * as emailPreferenceService from './email-preference.service';

/**
 * EmailController
 * ---------------
 * Handles:
 *   GET  /email/unsubscribe         — one-click unsubscribe from email links
 *   POST /email/webhook/sendgrid    — SendGrid event webhook
 *   GET  /email/preferences/:userId — get preferences (guarded in production)
 *   PATCH /email/preferences/:userId — update preferences
 *   POST /email/preferences/:userId/resubscribe — opt back in
 */
@Controller('email')
export class EmailController {
    constructor(
        private readonly emailService: EmailService,
        private readonly preferenceService: emailPreferenceService.EmailPreferenceService,
    ) { }

    /**
     * One-click unsubscribe — linked from every email footer.
     * ?token=xxx&global=true → global unsubscribe
     * ?token=xxx            → type-specific unsubscribe
     */
    @Get('unsubscribe')
    async unsubscribe(
        @Query('token') token: string,
        @Query('global') global?: string,
    ) {
        const isGlobal = global === 'true';
        return this.preferenceService.processUnsubscribeToken(token, isGlobal);
    }

    /**
     * SendGrid event webhook — receives delivery/bounce/unsubscribe events.
     * Register this URL in your SendGrid dashboard under Mail Settings → Event Webhook.
     */
    @Post('webhook/sendgrid')
    @HttpCode(HttpStatus.OK)
    async sendgridWebhook(@Body() events: any[]) {
        await this.emailService.handleSendGridWebhook(events);
        return { received: true };
    }

    /**
     * Get email preferences for a user.
     * In production, guard this with your JwtAuthGuard and ensure userId === req.user.id
     */
    @Get('preferences/:userId')
    async getPreferences(@Param('userId') userId: string) {
        return this.preferenceService.getPreferences(userId);
    }

    /**
     * Update email preferences for a user.
     */
    @Patch('preferences/:userId')
    async updatePreferences(
        @Param('userId') userId: string,
        @Body() dto: emailPreferenceService.UpdatePreferencesDto,
    ) {
        return this.preferenceService.updatePreferences(userId, dto);
    }

    /**
     * Re-subscribe a user to all email types.
     */
    @Post('preferences/:userId/resubscribe')
    async resubscribe(@Param('userId') userId: string) {
        return this.preferenceService.resubscribe(userId);
    }
}