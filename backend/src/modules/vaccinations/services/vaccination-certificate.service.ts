import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Vaccination } from './entities/vaccination.entity';

/**
 * Service for generating vaccination certificates in PDF format
 * Supports HIPAA-compliant document generation
 */
@Injectable()
export class VaccinationCertificateService {
  private readonly certificateDir = path.join(
    process.cwd(),
    'certificates',
  );

  constructor(
    @InjectRepository(Vaccination)
    private readonly vaccinationRepository: Repository<Vaccination>,
  ) {
    // Ensure certificate directory exists
    if (!fs.existsSync(this.certificateDir)) {
      fs.mkdirSync(this.certificateDir, { recursive: true });
    }
  }

  /**
   * Generate a PDF vaccination certificate
   */
  async generateCertificate(vaccinationId: string): Promise<Buffer> {
    const vaccination = await this.vaccinationRepository.findOne({
      where: { id: vaccinationId },
      relations: ['pet', 'vetClinic'],
    });

    if (!vaccination) {
      throw new BadRequestException(
        `Vaccination with ID ${vaccinationId} not found`,
      );
    }

    return await this.createPDFCertificate(vaccination);
  }

  /**
   * Generate and save a PDF vaccination certificate
   */
  async generateAndSaveCertificate(
    vaccinationId: string,
  ): Promise<{ url: string; fileName: string }> {
    const vaccination = await this.vaccinationRepository.findOne({
      where: { id: vaccinationId },
      relations: ['pet', 'vetClinic'],
    });

    if (!vaccination) {
      throw new BadRequestException(
        `Vaccination with ID ${vaccinationId} not found`,
      );
    }

    const fileName = `certificate-${vaccination.id}-${Date.now()}.pdf`;
    const filePath = path.join(this.certificateDir, fileName);

    const buffer = await this.createPDFCertificate(vaccination);

    // Save to filesystem
    fs.writeFileSync(filePath, buffer);

    // Update vaccination record with certificate URL
    vaccination.certificateUrl = `/certificates/${fileName}`;
    await this.vaccinationRepository.save(vaccination);

    return {
      url: vaccination.certificateUrl,
      fileName,
    };
  }

  /**
   * Create a PDF document for the vaccination certificate
   */
  private async createPDFCertificate(vaccination: Vaccination): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          bufferPages: true,
          size: 'A4',
          margin: 50,
        });

        // Collect chunks
        doc.on('data', (chunk) => {
          chunks.push(chunk);
        });

        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });

        doc.on('error', reject);

        // Create certificate content
        this.addCertificateContent(doc, vaccination);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add content to the PDF certificate
   */
  private addCertificateContent(
    doc: PDFDocument.PDFDocument,
    vaccination: Vaccination,
  ): void {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const centerX = pageWidth / 2;

    // Add decorative border
    doc
      .rect(30, 30, pageWidth - 60, pageHeight - 60)
      .stroke('#2c5aa0');

    doc
      .rect(35, 35, pageWidth - 70, pageHeight - 70)
      .stroke('#5b9bd5');

    // Title
    doc
      .font('Helvetica-Bold')
      .fontSize(36)
      .text('VACCINATION CERTIFICATE', 50, 80, {
        align: 'center',
      });

    // Divider line
    doc
      .moveTo(100, 130)
      .lineTo(pageWidth - 100, 130)
      .stroke('#2c5aa0');

    // Subtitle
    doc
      .font('Helvetica')
      .fontSize(14)
      .text('Official Record of Vaccination', 50, 145, {
        align: 'center',
      });

    // Main content
    let yPosition = 200;

    // Pet Information
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('PET INFORMATION', 80, yPosition);

    yPosition += 25;
    doc
      .font('Helvetica')
      .fontSize(11)
      .text(`Pet Name: ${vaccination.pet?.name || 'N/A'}`, 80, yPosition);

    yPosition += 20;
    doc.text(`Pet ID: ${vaccination.petId}`, 80, yPosition);

    yPosition += 20;
    doc.text(
      `Breed: ${vaccination.pet?.breed || 'N/A'}`,
      80,
      yPosition,
    );

    yPosition += 25;
    // Vaccination Information
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('VACCINATION DETAILS', 80, yPosition);

    yPosition += 25;
    doc
      .font('Helvetica')
      .fontSize(11)
      .text(`Vaccine Name: ${vaccination.vaccineName}`, 80, yPosition);

    yPosition += 20;
    doc.text(
      `Manufacturer: ${vaccination.manufacturer || 'N/A'}`,
      80,
      yPosition,
    );

    yPosition += 20;
    doc.text(
      `Batch Number: ${vaccination.batchNumber || 'N/A'}`,
      80,
      yPosition,
    );

    yPosition += 20;
    doc.text(
      `Date Administered: ${this.formatDate(vaccination.dateAdministered)}`,
      80,
      yPosition,
    );

    if (vaccination.expirationDate) {
      yPosition += 20;
      doc.text(
        `Expiration Date: ${this.formatDate(vaccination.expirationDate)}`,
        80,
        yPosition,
      );
    }

    if (vaccination.nextDueDate) {
      yPosition += 20;
      doc.text(
        `Next Due Date: ${this.formatDate(vaccination.nextDueDate)}`,
        80,
        yPosition,
      );
    }

    yPosition += 25;
    // Veterinarian Information
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('VETERINARIAN INFORMATION', 80, yPosition);

    yPosition += 25;
    doc
      .font('Helvetica')
      .fontSize(11)
      .text(`Veterinarian: ${vaccination.veterinarianName}`, 80, yPosition);

    if (vaccination.vetClinic?.name) {
      yPosition += 20;
      doc.text(`Clinic: ${vaccination.vetClinic.name}`, 80, yPosition);
    }

    if (vaccination.site) {
      yPosition += 20;
      doc.text(`Injection Site: ${vaccination.site}`, 80, yPosition);
    }

    if (vaccination.notes) {
      yPosition += 20;
      doc.text(`Notes: ${vaccination.notes}`, 80, yPosition, {
        width: pageWidth - 160,
      });
    }

    // Certificate code at bottom
    yPosition = pageHeight - 120;
    doc
      .moveTo(80, yPosition)
      .lineTo(pageWidth - 80, yPosition)
      .stroke('#2c5aa0');

    yPosition += 15;
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`Certificate Code: ${vaccination.certificateCode}`, 80, yPosition, {
        align: 'center',
      });

    yPosition += 20;
    doc
      .fontSize(9)
      .text(`Issued: ${this.formatDate(new Date())}`, 80, yPosition, {
        align: 'center',
      });

    yPosition += 15;
    doc.text('This certificate verifies that the vaccination detailed above', 80, yPosition, {
      align: 'center',
      fontSize: 8,
    });

    yPosition += 12;
    doc.text(
      'has been administered in accordance with veterinary standards.',
      80,
      yPosition,
      {
        align: 'center',
        fontSize: 8,
      },
    );
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  }

  /**
   * Get certificate file by ID
   */
  async getCertificateFile(fileName: string): Promise<Buffer> {
    const filePath = path.join(this.certificateDir, fileName);

    // Security: validate fileName doesn't contain path traversal
    if (!filePath.startsWith(this.certificateDir)) {
      throw new BadRequestException('Invalid certificate file path');
    }

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('Certificate file not found');
    }

    return fs.readFileSync(filePath);
  }

  /**
   * Delete certificate file
   */
  async deleteCertificateFile(fileName: string): Promise<void> {
    const filePath = path.join(this.certificateDir, fileName);

    // Security: validate fileName doesn't contain path traversal
    if (!filePath.startsWith(this.certificateDir)) {
      throw new BadRequestException('Invalid certificate file path');
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
