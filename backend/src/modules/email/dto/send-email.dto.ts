import { EmailType } from '../entities/email-log.entity';
import {
    VaccinationReminderData,
    AppointmentConfirmationData,
    MedicalRecordUpdateData,
    LostPetAlertData,
    SystemNotificationData,
} from '../templates/email-templates';

export interface QueueEmailDto {
    recipientEmail: string;
    recipientUserId?: string;
    type: EmailType;
    scheduledAt?: Date | string;
    metadata?: Record<string, unknown>;
}

// ── Typed send DTOs — one per email type ─────────────────────────────────────

export interface SendVaccinationReminderDto extends QueueEmailDto {
    type: EmailType.VACCINATION_REMINDER;
    data: VaccinationReminderData;
}

export interface SendAppointmentConfirmationDto extends QueueEmailDto {
    type: EmailType.APPOINTMENT_CONFIRMATION;
    data: AppointmentConfirmationData;
}

export interface SendMedicalRecordUpdateDto extends QueueEmailDto {
    type: EmailType.MEDICAL_RECORD_UPDATE;
    data: MedicalRecordUpdateData;
}

export interface SendLostPetAlertDto extends QueueEmailDto {
    type: EmailType.LOST_PET_ALERT;
    data: LostPetAlertData;
}

export interface SendSystemNotificationDto extends QueueEmailDto {
    type: EmailType.SYSTEM_NOTIFICATION;
    data: SystemNotificationData;
}

export interface SendVerificationEmailDto extends QueueEmailDto {
    type: EmailType.VERIFICATION;
    data: { email: string; token: string; name?: string };
}

export interface SendPasswordResetDto extends QueueEmailDto {
    type: EmailType.PASSWORD_RESET;
    data: { email: string; token: string; name?: string };
}

export type SendEmailDto =
    | SendVaccinationReminderDto
    | SendAppointmentConfirmationDto
    | SendMedicalRecordUpdateDto
    | SendLostPetAlertDto
    | SendSystemNotificationDto
    | SendVerificationEmailDto
    | SendPasswordResetDto;
