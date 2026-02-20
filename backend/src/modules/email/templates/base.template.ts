export interface BaseTemplateOptions {
  previewText?: string;
  unsubscribeUrl?: string;
  /** Type label shown in footer e.g. "vaccination reminder" */
  emailTypeLabel?: string;
}

/**
 * Wraps any email body in a clean, responsive HTML shell.
 * Works in all major email clients including Outlook.
 */
export function baseTemplate(body: string, options: BaseTemplateOptions = {}): string {
  const { previewText = '', unsubscribeUrl, emailTypeLabel } = options;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Email</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f4f4f7; }
    a { color: #4f46e5; }

    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .content-cell { padding: 24px 16px !important; }
      .stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body>
  <!-- Preview text (hidden, shows in inbox) -->
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>` : ''}

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding: 40px 16px;">

        <!-- Email container -->
        <table class="email-container" role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#4f46e5; padding:28px 40px; text-align:center;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:22px; font-weight:700; color:#ffffff; letter-spacing:-0.3px;">
                🐾 PetCare
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="content-cell" style="padding:40px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.7; color:#374151;">
              ${body}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none; border-top:1px solid #e5e7eb; margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 40px; text-align:center; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:12px; color:#9ca3af; line-height:1.6;">
              <p style="margin:0 0 8px;">You received this email because you have an account with PetCare.</p>
              ${emailTypeLabel ? `<p style="margin:0 0 8px;">This is a <strong>${emailTypeLabel}</strong> email.</p>` : ''}
              ${
                unsubscribeUrl
                  ? `<p style="margin:0;">
                      <a href="${unsubscribeUrl}" style="color:#9ca3af; text-decoration:underline;">Unsubscribe</a>
                      &nbsp;·&nbsp;
                      <a href="${unsubscribeUrl}?global=true" style="color:#9ca3af; text-decoration:underline;">Unsubscribe from all emails</a>
                    </p>`
                  : ''
              }
              <p style="margin:8px 0 0;">© ${new Date().getFullYear()} PetCare. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Reusable button component for templates */
export function emailButton(text: string, url: string, color = '#4f46e5'): string {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:8px; background-color:${color};">
          <a href="${url}" target="_blank"
             style="display:inline-block; padding:14px 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Reusable info box (light background callout) */
export function emailInfoBox(content: string, color = '#eff6ff', borderColor = '#bfdbfe'): string {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;">
      <tr>
        <td style="background-color:${color}; border-left:4px solid ${borderColor}; border-radius:6px; padding:16px 20px;
                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; color:#374151; line-height:1.6;">
          ${content}
        </td>
      </tr>
    </table>`;
}