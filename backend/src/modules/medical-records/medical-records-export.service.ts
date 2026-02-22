import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import * as nodemailer from 'nodemailer';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecord } from './entities/medical-record.entity';
import {
  ExportFormat,
  ExportMedicalRecordsDto,
} from './dto/export-medical-records.dto';

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

@Injectable()
export class MedicalRecordsExportService {
  private mailer: nodemailer.Transporter | null = null;

  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
    private readonly configService: ConfigService,
  ) {
    this.initMailer();
  }

  private initMailer(): void {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = this.configService.get<number>('MAIL_PORT');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');
    if (host && port && user && pass) {
      this.mailer = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  /**
   * Resolve which records to export from DTO (either by IDs or batch filter).
   */
  async getRecordsForExport(
    dto: ExportMedicalRecordsDto,
  ): Promise<MedicalRecord[]> {
    if (dto.recordIds && dto.recordIds.length > 0) {
      const records = await this.medicalRecordsService.findByIds(dto.recordIds);
      if (records.length !== dto.recordIds.length) {
        const foundIds = new Set(records.map((r) => r.id));
        const missing = dto.recordIds.filter((id) => !foundIds.has(id));
        throw new NotFoundException(
          `Medical record(s) not found: ${missing.join(', ')}`,
        );
      }
      return records;
    }
    if (dto.petId) {
      return this.medicalRecordsService.findAll(
        dto.petId,
        dto.recordType,
        dto.startDate,
        dto.endDate,
      );
    }
    throw new BadRequestException(
      'Provide either recordIds or petId for export.',
    );
  }

  async export(dto: ExportMedicalRecordsDto): Promise<ExportResult> {
    const records = await this.getRecordsForExport(dto);
    if (!records.length) {
      throw new BadRequestException('No medical records match the criteria.');
    }

    const includeAttachments = dto.includeAttachments !== false;

    switch (dto.format) {
      case ExportFormat.PDF:
        return this.exportPdf(records, includeAttachments);
      case ExportFormat.CSV:
        return this.exportCsv(records, includeAttachments);
      case ExportFormat.FHIR:
        return this.exportFhir(records, includeAttachments);
      default:
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new BadRequestException(`Unsupported format: ${dto.format}`);
    }
  }

  private async exportPdf(
    records: MedicalRecord[],
    includeAttachments: boolean,
  ): Promise<ExportResult> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: 'application/pdf',
          filename: `medical-records-${Date.now()}.pdf`,
        }),
      );
      doc.on('error', reject);

      doc.fontSize(18).text('Medical Records Export', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);

      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (i > 0) doc.addPage();
        doc
          .fontSize(14)
          .text(`Record ${i + 1}: ${r.recordType}`, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);
        doc.text(`Date: ${new Date(r.date).toLocaleDateString()}`);
        doc.text(`Pet: ${(r.pet as { name?: string })?.name ?? 'N/A'}`);
        if (r.vet) {
          const vet = r.vet as { vetName?: string; clinicName?: string };
          doc.text(`Vet: ${vet.vetName ?? ''} (${vet.clinicName ?? ''})`);
        }
        doc.text(`Diagnosis: ${r.diagnosis}`);
        doc.text(`Treatment: ${r.treatment}`);
        if (r.notes) doc.text(`Notes: ${r.notes}`);
        if (includeAttachments && r.attachments?.length) {
          doc.moveDown(0.5).text('Attachments:', { continued: false });
          r.attachments.forEach((a) => doc.text(`  - ${a}`, { indent: 20 }));
        }
        doc.moveDown(1);
      }

      doc.end();
    });
  }

  private exportCsv(
    records: MedicalRecord[],
    includeAttachments: boolean,
  ): ExportResult {
    const include = includeAttachments;
    const rows = records.map((r) => ({
      id: r.id,
      petId: r.petId,
      petName: (r.pet as { name?: string })?.name ?? '',
      vetId: r.vetId ?? '',
      vetName: (r.vet as { vetName?: string })?.vetName ?? '',
      recordType: r.recordType,
      date: new Date(r.date).toISOString().split('T')[0],
      diagnosis: r.diagnosis,
      treatment: r.treatment,
      notes: r.notes ?? '',
      attachments:
        include && r.attachments?.length ? r.attachments.join('; ') : '',
    }));

    const parser = new Parser({
      fields: [
        'id',
        'petId',
        'petName',
        'vetId',
        'vetName',
        'recordType',
        'date',
        'diagnosis',
        'treatment',
        'notes',
        ...(include ? ['attachments'] : []),
      ],
    });
    const csv = parser.parse(rows);

    return {
      buffer: Buffer.from(csv, 'utf-8'),
      contentType: 'text/csv',
      filename: `medical-records-${Date.now()}.csv`,
    };
  }

  private exportFhir(
    records: MedicalRecord[],
    includeAttachments: boolean,
  ): ExportResult {
    const entries: Array<{ fullUrl: string; resource: object }> = [];
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    records.forEach((r) => {
      const id = r.id;
      const docRef = {
        resourceType: 'DocumentReference',
        id,
        status: 'current',
        type: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '34117-2',
              display: 'Veterinary medical record',
            },
          ],
        },
        subject: {
          reference: `Patient/${r.petId}`,
          display: (r.pet as { name?: string })?.name,
        },
        date: new Date(r.date).toISOString(),
        description: `${r.recordType}: ${r.diagnosis}`,
        content: [
          {
            attachment: {
              contentType: 'text/plain',
              title: `Record ${r.recordType}`,
              creation: (r as { createdAt?: Date }).createdAt
                ? new Date((r as { createdAt: Date }).createdAt).toISOString()
                : undefined,
            },
          },
        ],
        context: {
          period: {
            start: new Date(r.date).toISOString(),
            end: new Date(r.date).toISOString(),
          },
          facilityType: (r.vet as { clinicName?: string })?.clinicName,
          practiceSetting: 'veterinary',
        },
      };

      if (includeAttachments && r.attachments?.length) {
        (docRef as { content: Array<{ attachment: object }> }).content = [
          ...(docRef as { content: Array<{ attachment: object }> }).content,
          ...r.attachments.map((att, i) => ({
            attachment: {
              contentType: 'application/octet-stream',
              title: att.startsWith('http') ? `Attachment ${i + 1}` : att,
              ...(att.startsWith('http')
                ? { url: att }
                : { url: `${baseUrl}/api/v1/files/${att}/download` }),
            },
          })),
        ];
      }

      entries.push({
        fullUrl: `${baseUrl}/fhir/DocumentReference/${id}`,
        resource: docRef,
      });
    });

    const bundle = {
      resourceType: 'Bundle',
      id: `export-${Date.now()}`,
      type: 'document',
      timestamp: new Date().toISOString(),
      total: entries.length,
      entry: entries,
    };

    const json = JSON.stringify(bundle, null, 2);
    return {
      buffer: Buffer.from(json, 'utf-8'),
      contentType: 'application/fhir+json',
      filename: `medical-records-fhir-${Date.now()}.json`,
    };
  }

  /**
   * Send export by email. Uses MAIL_* env if set; otherwise no-op and throws.
   */
  async sendExportByEmail(
    dto: ExportMedicalRecordsDto & { to?: string; message?: string },
    recipientEmail: string,
  ): Promise<{ sent: boolean; message: string }> {
    const result = await this.export(dto);
    if (!this.mailer) {
      throw new BadRequestException(
        'Email export is not configured. Set MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS.',
      );
    }

    const to = dto.to || recipientEmail;
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      'noreply@petchain.com';

    await this.mailer.sendMail({
      from,
      to,
      subject: `PetChain Medical Records Export (${dto.format})`,
      text:
        (dto.message || 'Please find your medical records export attached.') +
        `\n\nFormat: ${dto.format}\nGenerated: ${new Date().toISOString()}`,
      attachments: [
        {
          filename: result.filename,
          content: result.buffer,
        },
      ],
    });

    return {
      sent: true,
      message: `Export sent to ${to}`,
    };
  }
}
