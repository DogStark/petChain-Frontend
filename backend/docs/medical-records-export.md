# Medical Records Export

## Overview

Medical records can be exported in multiple formats, with optional batch selection and email delivery. Attachments are included as metadata (and in FHIR as references).

## Acceptance Criteria (Implemented)

| Criteria | Implementation |
|----------|----------------|
| **Export to PDF** | `MedicalRecordsExportService.exportPdf()` – uses `pdfkit` to generate a multi-page PDF with one record per page, including pet/vet info, diagnosis, treatment, notes, and an "Attachments" section listing attachment paths/IDs. |
| **Export to CSV** | `MedicalRecordsExportService.exportCsv()` – uses `json2csv` to export flat rows (id, petId, petName, vetId, vetName, recordType, date, diagnosis, treatment, notes, attachments). |
| **Export to FHIR** | `MedicalRecordsExportService.exportFhir()` – builds a FHIR R4 `Bundle` of type `document` with `DocumentReference` resources per record; attachments are referenced in `content.attachment` (title and optional URL for download). |
| **Include all attachments** | Every format includes attachment metadata: PDF lists them per record; CSV has an `attachments` column (semicolon-separated); FHIR `DocumentReference.content[].attachment` lists each attachment. Optional `includeAttachments: false` disables in PDF/CSV (FHIR always includes). |
| **Batch export** | Selection is by **record IDs** (`recordIds`) or by **pet + filters** (`petId`, optional `recordType`, `startDate`, `endDate`). `getRecordsForExport()` resolves to a list of records; export then runs on that list. |
| **Email export** | `POST /medical-records/export/email` with same body as export plus `to` and optional `message`. Uses `nodemailer`; transport is configured from `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`. The generated file (PDF/CSV/FHIR) is attached and sent to `to` or the current user email. |

## Flow

1. **Request** – Client calls GET or POST `/medical-records/export` with `format` and either `recordIds` or `petId` (and optional filters), or POST `/medical-records/export/email` with the same plus `to`/`message`.
2. **Resolve records** – `MedicalRecordsExportService.getRecordsForExport(dto)` returns `MedicalRecord[]` (by IDs or via `MedicalRecordsService.findAll` for batch).
3. **Generate file** – `export()` calls `exportPdf`, `exportCsv`, or `exportFhir` and returns `{ buffer, contentType, filename }`.
4. **Response** – For download: controller returns `StreamableFile` with appropriate `Content-Type` and `Content-Disposition`. For email: service sends mail with the file attached and returns `{ sent: true, message }`.

## Files

- **DTOs**: `dto/export-medical-records.dto.ts` – `ExportFormat` (pdf | csv | fhir), `ExportMedicalRecordsDto`, `EmailExportMedicalRecordsDto`.
- **Service**: `medical-records-export.service.ts` – `getRecordsForExport`, `export`, `exportPdf`, `exportCsv`, `exportFhir`, `sendExportByEmail`.
- **Controller**: `medical-records.controller.ts` – `GET /export`, `POST /export`, `POST /export/email`.
- **Module**: `medical-records.module.ts` – registers `MedicalRecordsExportService`, imports `ConfigModule` for mail/config.

## Dependencies

- **pdfkit** – PDF generation.
- **nodemailer** – Sending email with attachment (optional; email export fails with a clear error if MAIL_* is not set).
- **json2csv** – Already present; used for CSV.

## Environment (Email)

```env
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=user
MAIL_PASS=secret
MAIL_FROM=noreply@petchain.com   # optional
```

If these are not set, `sendExportByEmail` throws with a message that email export is not configured.
