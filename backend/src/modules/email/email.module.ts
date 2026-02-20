import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { emailConfig } from './email.config';
import { EmailLog } from './entities/email-log.entity';
import { EmailPreference } from './entities/email-preference.entity';
import { EmailUnsubscribe } from './entities/email-unsubscribe.entity';
import { EmailService } from './email.service';
import { EmailPreferenceService } from './email-preference.service';
import { EmailController } from './email.controller';

@Module({
    imports: [
        ConfigModule.forFeature(emailConfig),
        TypeOrmModule.forFeature([EmailLog, EmailPreference, EmailUnsubscribe]),
    ],
    controllers: [EmailController],
    providers: [EmailService, EmailPreferenceService],
    /**
     * Export both services so other modules (VaccinationsModule, RemindersModule, etc.)
     * can inject EmailService directly without re-importing the whole module.
     */
    exports: [EmailService, EmailPreferenceService],
})
export class EmailModule { }
