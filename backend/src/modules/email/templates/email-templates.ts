import { baseTemplate, emailButton, emailInfoBox } from './base.template';

// ─────────────────────────────────────────────────────────────────────────────
// 1. VACCINATION REMINDER
// ─────────────────────────────────────────────────────────────────────────────
export interface VaccinationReminderData {
  ownerName: string;
  petName: string;
  vaccineName: string;
  dueDate: string;       // formatted date string
  vetClinicName?: string;
  bookingUrl?: string;
  unsubscribeUrl?: string;
}

export function vaccinationReminderTemplate(data: VaccinationReminderData): { subject: string; html: string; text: string } {
  const subject = `Vaccination reminder: ${data.petName} is due for ${data.vaccineName}`;

  const body = `
    <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:#111827;">
      Vaccination Reminder 💉
    </h1>
    <p style="margin:0 0 20px; color:#6b7280; font-size:14px;">Time to keep ${data.petName} protected</p>

    <p>Hi ${data.ownerName},</p>
    <p>This is a friendly reminder that <strong>${data.petName}</strong> is due for their <strong>${data.vaccineName}</strong> vaccination.</p>

    ${emailInfoBox(`
      <strong>📅 Due date:</strong> ${data.dueDate}<br/>
      <strong>🐾 Pet:</strong> ${data.petName}<br/>
      <strong>💉 Vaccine:</strong> ${data.vaccineName}
      ${data.vetClinicName ? `<br/><strong>🏥 Clinic:</strong> ${data.vetClinicName}` : ''}
    `)}

    <p>Staying up to date with vaccinations is one of the best ways to keep your pet healthy and protected against preventable diseases.</p>

    ${data.bookingUrl ? emailButton('Book Appointment', data.bookingUrl) : ''}

    <p style="color:#6b7280; font-size:13px;">If you have already scheduled this appointment, you can disregard this reminder.</p>
  `;

  const html = baseTemplate(body, {
    previewText: `${data.petName}'s ${data.vaccineName} vaccination is due on ${data.dueDate}`,
    unsubscribeUrl: data.unsubscribeUrl,
    emailTypeLabel: 'vaccination reminder',
  });

  const text = `
Vaccination Reminder

Hi ${data.ownerName},

${data.petName} is due for their ${data.vaccineName} vaccination on ${data.dueDate}.
${data.vetClinicName ? `Clinic: ${data.vetClinicName}` : ''}
${data.bookingUrl ? `Book an appointment: ${data.bookingUrl}` : ''}

If you have already scheduled this, please disregard this reminder.
  `.trim();

  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. APPOINTMENT CONFIRMATION
// ─────────────────────────────────────────────────────────────────────────────
export interface AppointmentConfirmationData {
  ownerName: string;
  petName: string;
  appointmentDate: string;
  appointmentTime: string;
  vetName: string;
  clinicName: string;
  clinicAddress?: string;
  appointmentType: string;
  confirmationNumber: string;
  cancelUrl?: string;
  unsubscribeUrl?: string;
}

export function appointmentConfirmationTemplate(data: AppointmentConfirmationData): { subject: string; html: string; text: string } {
  const subject = `Appointment confirmed: ${data.petName} on ${data.appointmentDate}`;

  const body = `
    <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:#111827;">
      Appointment Confirmed ✅
    </h1>
    <p style="margin:0 0 20px; color:#6b7280; font-size:14px;">Your booking is all set</p>

    <p>Hi ${data.ownerName},</p>
    <p>Your appointment for <strong>${data.petName}</strong> has been confirmed. Here are your details:</p>

    ${emailInfoBox(`
      <strong>📅 Date:</strong> ${data.appointmentDate}<br/>
      <strong>🕐 Time:</strong> ${data.appointmentTime}<br/>
      <strong>🐾 Pet:</strong> ${data.petName}<br/>
      <strong>🩺 Vet:</strong> Dr. ${data.vetName}<br/>
      <strong>🏥 Clinic:</strong> ${data.clinicName}<br/>
      ${data.clinicAddress ? `<strong>📍 Address:</strong> ${data.clinicAddress}<br/>` : ''}
      <strong>📋 Type:</strong> ${data.appointmentType}<br/>
      <strong>🔖 Confirmation #:</strong> ${data.confirmationNumber}
    `)}

    <p>Please arrive 5–10 minutes early. If you need to cancel or reschedule, please do so at least 24 hours in advance.</p>

    ${data.cancelUrl ? emailButton('Cancel / Reschedule', data.cancelUrl, '#dc2626') : ''}
  `;

  const html = baseTemplate(body, {
    previewText: `${data.petName}'s appointment confirmed for ${data.appointmentDate} at ${data.appointmentTime}`,
    unsubscribeUrl: data.unsubscribeUrl,
    emailTypeLabel: 'appointment confirmation',
  });

  const text = `
Appointment Confirmed

Hi ${data.ownerName},

Your appointment for ${data.petName} is confirmed.

Date: ${data.appointmentDate}
Time: ${data.appointmentTime}
Vet: Dr. ${data.vetName}
Clinic: ${data.clinicName}
${data.clinicAddress ? `Address: ${data.clinicAddress}` : ''}
Type: ${data.appointmentType}
Confirmation #: ${data.confirmationNumber}

${data.cancelUrl ? `Cancel/Reschedule: ${data.cancelUrl}` : ''}
  `.trim();

  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MEDICAL RECORD UPDATE
// ─────────────────────────────────────────────────────────────────────────────
export interface MedicalRecordUpdateData {
  ownerName: string;
  petName: string;
  recordType: string;   // e.g. "Lab Results", "Treatment Plan", "Diagnosis"
  updatedBy: string;    // vet name
  updatedAt: string;
  summary?: string;
  viewRecordUrl?: string;
  unsubscribeUrl?: string;
}

export function medicalRecordUpdateTemplate(data: MedicalRecordUpdateData): { subject: string; html: string; text: string } {
  const subject = `Medical record updated for ${data.petName}`;

  const body = `
    <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:#111827;">
      Medical Record Updated 📋
    </h1>
    <p style="margin:0 0 20px; color:#6b7280; font-size:14px;">A new update has been added to ${data.petName}'s records</p>

    <p>Hi ${data.ownerName},</p>
    <p><strong>Dr. ${data.updatedBy}</strong> has added a new <strong>${data.recordType}</strong> to <strong>${data.petName}'s</strong> medical records.</p>

    ${emailInfoBox(`
      <strong>📋 Record type:</strong> ${data.recordType}<br/>
      <strong>🐾 Pet:</strong> ${data.petName}<br/>
      <strong>👨‍⚕️ Updated by:</strong> Dr. ${data.updatedBy}<br/>
      <strong>🕐 Updated at:</strong> ${data.updatedAt}
      ${data.summary ? `<br/><br/><strong>Summary:</strong><br/>${data.summary}` : ''}
    `)}

    ${data.viewRecordUrl ? emailButton('View Full Record', data.viewRecordUrl) : ''}

    <p style="color:#6b7280; font-size:13px;">If you have any questions about this update, please contact your vet directly.</p>
  `;

  const html = baseTemplate(body, {
    previewText: `New ${data.recordType} added to ${data.petName}'s medical records by Dr. ${data.updatedBy}`,
    unsubscribeUrl: data.unsubscribeUrl,
    emailTypeLabel: 'medical record update',
  });

  const text = `
Medical Record Updated

Hi ${data.ownerName},

Dr. ${data.updatedBy} has added a new ${data.recordType} to ${data.petName}'s records on ${data.updatedAt}.
${data.summary ? `\nSummary: ${data.summary}` : ''}
${data.viewRecordUrl ? `\nView record: ${data.viewRecordUrl}` : ''}
  `.trim();

  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LOST PET ALERT
// ─────────────────────────────────────────────────────────────────────────────
export interface LostPetAlertData {
  ownerName: string;
  petName: string;
  petSpecies: string;
  petBreed?: string;
  petColor?: string;
  lastSeenLocation: string;
  lastSeenDate: string;
  contactPhone?: string;
  contactEmail: string;
  petImageUrl?: string;
  reportUrl?: string;
  unsubscribeUrl?: string;
}

export function lostPetAlertTemplate(data: LostPetAlertData): { subject: string; html: string; text: string } {
  const subject = `🚨 Lost pet alert: ${data.petName} (${data.petSpecies}) near ${data.lastSeenLocation}`;

  const body = `
    <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:#dc2626;">
      🚨 Lost Pet Alert
    </h1>
    <p style="margin:0 0 20px; color:#6b7280; font-size:14px;">Please help bring ${data.petName} home</p>

    ${data.petImageUrl ? `
    <div style="text-align:center; margin-bottom:24px;">
      <img src="${data.petImageUrl}" alt="${data.petName}" width="200" style="border-radius:12px; max-width:200px; object-fit:cover;" />
    </div>` : ''}

    <p>Hi ${data.ownerName},</p>
    <p>A lost pet has been reported in your area. If you have any information, please contact the owner immediately.</p>

    ${emailInfoBox(`
      <strong>🐾 Pet name:</strong> ${data.petName}<br/>
      <strong>🦮 Species:</strong> ${data.petSpecies}<br/>
      ${data.petBreed ? `<strong>🏷️ Breed:</strong> ${data.petBreed}<br/>` : ''}
      ${data.petColor ? `<strong>🎨 Color:</strong> ${data.petColor}<br/>` : ''}
      <strong>📍 Last seen:</strong> ${data.lastSeenLocation}<br/>
      <strong>📅 Date:</strong> ${data.lastSeenDate}
    `, '#fff7ed', '#fed7aa')}

    ${emailInfoBox(`
      <strong>Contact the owner:</strong><br/>
      📧 ${data.contactEmail}
      ${data.contactPhone ? `<br/>📞 ${data.contactPhone}` : ''}
    `, '#f0fdf4', '#bbf7d0')}

    ${data.reportUrl ? emailButton('I Found This Pet', data.reportUrl, '#16a34a') : ''}

    <p style="color:#6b7280; font-size:13px;">This alert was sent because a lost pet was reported near your registered location.</p>
  `;

  const html = baseTemplate(body, {
    previewText: `Lost ${data.petSpecies} named ${data.petName} last seen near ${data.lastSeenLocation}`,
    unsubscribeUrl: data.unsubscribeUrl,
    emailTypeLabel: 'lost pet alert',
  });

  const text = `
LOST PET ALERT

${data.petName} (${data.petSpecies}${data.petBreed ? `, ${data.petBreed}` : ''}) is missing.

Last seen: ${data.lastSeenLocation} on ${data.lastSeenDate}
${data.petColor ? `Description: ${data.petColor}` : ''}

Contact owner:
Email: ${data.contactEmail}
${data.contactPhone ? `Phone: ${data.contactPhone}` : ''}

${data.reportUrl ? `Report sighting: ${data.reportUrl}` : ''}
  `.trim();

  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SYSTEM NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export interface SystemNotificationData {
  recipientName: string;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'success' | 'error';
  actionLabel?: string;
  actionUrl?: string;
  unsubscribeUrl?: string;
}

const SEVERITY_STYLES = {
  info:    { bg: '#eff6ff', border: '#bfdbfe', icon: 'ℹ️' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '⚠️' },
  success: { bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' },
  error:   { bg: '#fef2f2', border: '#fecaca', icon: '🚨' },
};

export function systemNotificationTemplate(data: SystemNotificationData): { subject: string; html: string; text: string } {
  const severity = data.severity ?? 'info';
  const style = SEVERITY_STYLES[severity];
  const subject = data.title;

  const body = `
    <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:#111827;">
      ${style.icon} ${data.title}
    </h1>
    <p style="margin:0 0 24px; color:#6b7280; font-size:14px;">System notification</p>

    <p>Hi ${data.recipientName},</p>

    ${emailInfoBox(data.message, style.bg, style.border)}

    ${data.actionLabel && data.actionUrl ? emailButton(data.actionLabel, data.actionUrl) : ''}
  `;

  const html = baseTemplate(body, {
    previewText: data.message.replace(/<[^>]+>/g, '').slice(0, 100),
    unsubscribeUrl: data.unsubscribeUrl,
    emailTypeLabel: 'system notification',
  });

  const text = `
${data.title}

Hi ${data.recipientName},

${data.message.replace(/<[^>]+>/g, '')}

${data.actionLabel && data.actionUrl ? `${data.actionLabel}: ${data.actionUrl}` : ''}
  `.trim();

  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. MEDICAL RECORD SHARE
// ─────────────────────────────────────────────────────────────────────────────
export interface MedicalRecordShareData {
  recipientName?: string;
  senderName: string;
  petName: string;
  recordType: string;
  recordDate: string;
  shareUrl: string;
  expiresAt?: string;
  permission: 'view' | 'edit';
  message?: string;
  unsubscribeUrl?: string;
}

export function medicalRecordShareTemplate(data: MedicalRecordShareData): { subject: string; html: string; text: string } {
  const subject = `${data.senderName} shared a medical record with you`;
  const recipientGreeting = data.recipientName ? `Hi ${data.recipientName},` : 'Hello,';
  const permissionLabel = data.permission === 'edit' ? 'view and edit' : 'view';
  const expiryNote = data.expiresAt 
    ? `<p style="color:#6b7280; font-size:13px;">⏰ This link expires on ${data.expiresAt}.</p>` 
    : '';

  const messageBox = data.message 
    ? `<div style="margin:16px 0; padding:12px 16px; background:#f9fafb; border-left:4px solid #3b82f6; border-radius:4px; font-style:italic;">
        "${data.message}"
       </div>`
    : '';

  const body = `
    <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:#111827;">
      Medical Record Shared 📋
    </h1>
    <p style="margin:0 0 20px; color:#6b7280; font-size:14px;">${data.senderName} wants to share important health information with you</p>

    <p>${recipientGreeting}</p>
    <p><strong>${data.senderName}</strong> has shared a medical record with you. You have permission to <strong>${permissionLabel}</strong> this record.</p>

    ${messageBox}

    ${emailInfoBox(`
      <strong>🐾 Pet:</strong> ${data.petName}<br/>
      <strong>📋 Record Type:</strong> ${data.recordType}<br/>
      <strong>📅 Date:</strong> ${data.recordDate}<br/>
      <strong>🔐 Permission:</strong> ${data.permission === 'edit' ? 'View & Edit' : 'View Only'}
    `)}

    ${emailButton('View Medical Record', data.shareUrl)}

    ${expiryNote}

    <p style="color:#6b7280; font-size:13px;">If you weren't expecting this email, you can safely ignore it. The link requires no account to access.</p>
  `;

  const html = baseTemplate(body, {
    previewText: `${data.senderName} shared ${data.petName}'s ${data.recordType} record with you`,
    unsubscribeUrl: data.unsubscribeUrl,
    emailTypeLabel: 'medical record share',
  });

  const text = `
Medical Record Shared

${recipientGreeting}

${data.senderName} has shared a medical record with you.

Pet: ${data.petName}
Record Type: ${data.recordType}
Date: ${data.recordDate}
Permission: ${data.permission === 'edit' ? 'View & Edit' : 'View Only'}

${data.message ? `Message: "${data.message}"` : ''}

View the record: ${data.shareUrl}

${data.expiresAt ? `This link expires on ${data.expiresAt}.` : ''}
  `.trim();

  return { subject, html, text };
}