import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
    sendgridApiKey: process.env.SENDGRID_API_KEY ?? '',
    fromEmail: process.env.EMAIL_FROM ?? 'noreply@petcare.app',
    fromName: process.env.EMAIL_FROM_NAME ?? 'PetCare',
    appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',

    queue: {
        /** How many emails the processor picks up per run */
        batchSize: parseInt(process.env.EMAIL_QUEUE_BATCH_SIZE ?? '10', 10),
        /** Seconds between queue processing runs */
        intervalSeconds: parseInt(process.env.EMAIL_QUEUE_INTERVAL_SECONDS ?? '30', 10),
        /** Base delay in seconds before first retry */
        retryBaseDelaySeconds: parseInt(process.env.EMAIL_RETRY_BASE_DELAY_SECONDS ?? '60', 10),
        /** Multiplier applied to delay on each subsequent retry (exponential backoff) */
        retryBackoffMultiplier: parseInt(process.env.EMAIL_RETRY_BACKOFF_MULTIPLIER ?? '3', 10),
        /** Max retry attempts before marking as permanently failed */
        maxAttempts: parseInt(process.env.EMAIL_MAX_ATTEMPTS ?? '3', 10),
    },
}));
