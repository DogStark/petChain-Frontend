import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vaccination } from '../vaccinations/entities/vaccination.entity';
import { Pet } from '../pets/entities/pet.entity';
import PDFDocument from 'pdfkit';

export interface VaccinationCertificate {
  certificateCode: string;
  issuedDate: Date;
  vaccination: {
    id: string;
    vaccineName: string;
    administeredDate: Date;
    expirationDate: Date | null;
    manufacturer: string | null;
    batchNumber: string | null;
    site: string | null;
    veterinarianName: string;
  };
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    dateOfBirth: Date;
    microchipNumber: string | null;
  };
  owner: {
    id: string;
    name: string;
    email: string;
  } | null;
  vetClinic: {
    id: string;
    name: string;
    address: string;
    phone: string;
  } | null;
  isValid: boolean;
  verificationUrl: string;
}

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(Vaccination)
    private readonly vaccinationRepository: Repository<Vaccination>,
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
  ) {}

  /**
   * Generate a certificate for a vaccination
   */
  async generateCertificate(
    vaccinationId: string,
  ): Promise<VaccinationCertificate> {
    const vaccination = await this.vaccinationRepository.findOne({
      where: { id: vaccinationId },
      relations: ['pet', 'pet.breed', 'pet.owner', 'vet', 'vetClinic'],
    });

    if (!vaccination) {
      throw new NotFoundException(
        `Vaccination with ID ${vaccinationId} not found`,
      );
    }

    const isValid = this.validateCertificate(vaccination);

    return {
      certificateCode:
        vaccination.certificateCode ||
        `VAX-${vaccination.id.substring(0, 12).toUpperCase()}`,
      issuedDate: vaccination.createdAt,
      vaccination: {
        id: vaccination.id,
        vaccineName: vaccination.vaccineName,
        administeredDate: vaccination.administeredDate,
        expirationDate: vaccination.expirationDate,
        manufacturer: vaccination.manufacturer,
        batchNumber: vaccination.batchNumber,
        site: vaccination.site,
        veterinarianName: vaccination.veterinarianName || vaccination.vet?.vetName || 'N/A',
      },
      pet: {
        id: vaccination.pet.id,
        name: vaccination.pet.name,
        species: vaccination.pet.species,
        breed: vaccination.pet.breed?.name || null,
        dateOfBirth: vaccination.pet.dateOfBirth,
        microchipNumber: vaccination.pet.microchipNumber,
      },
      owner: vaccination.pet.owner
        ? {
            id: vaccination.pet.owner.id,
            name: `${vaccination.pet.owner.firstName} ${vaccination.pet.owner.lastName}`,
            email: vaccination.pet.owner.email,
          }
        : null,
      vetClinic: vaccination.vetClinic
        ? {
            id: vaccination.vetClinic.id,
            name: vaccination.vetClinic.name,
            address: vaccination.vetClinic.address,
            phone: vaccination.vetClinic.phone,
          }
        : null,
      isValid,
      verificationUrl: `/api/certificates/verify/${vaccination.certificateCode}`,
    };
  }

  /**
   * Get certificate by vaccination ID
   */
  async getCertificateByVaccination(
    vaccinationId: string,
  ): Promise<VaccinationCertificate> {
    return await this.generateCertificate(vaccinationId);
  }

  /**
   * Verify a certificate by code
   */
  async verifyCertificate(
    code: string,
  ): Promise<{ isValid: boolean; certificate: VaccinationCertificate | null }> {
    const vaccination = await this.vaccinationRepository.findOne({
      where: { certificateCode: code },
      relations: ['pet', 'pet.breed', 'pet.owner', 'vet', 'vetClinic'],
    });

    if (!vaccination) {
      return { isValid: false, certificate: null };
    }

    const certificate = await this.generateCertificate(vaccination.id);
    return { isValid: certificate.isValid, certificate };
  }

  /**
   * Get all certificates for a pet
   */
  async getCertificatesForPet(
    petId: string,
  ): Promise<VaccinationCertificate[]> {
    const vaccinations = await this.vaccinationRepository.find({
      where: { petId },
      relations: ['pet', 'pet.breed', 'pet.owner', 'vet', 'vetClinic'],
      order: { administeredDate: 'DESC' },
    });

    const certificates: VaccinationCertificate[] = [];
    for (const vaccination of vaccinations) {
      certificates.push(await this.generateCertificate(vaccination.id));
    }

    return certificates;
  }

  async generateCertificatePdf(vaccinationId: string): Promise<Buffer> {
    const certificate = await this.generateCertificate(vaccinationId);

    return await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Vaccination Certificate', { align: 'center' });
      doc.moveDown(1.5);

      doc.fontSize(11).text(`Certificate Code: ${certificate.certificateCode}`);
      doc.text(`Issued Date: ${new Date(certificate.issuedDate).toDateString()}`);
      doc.text(`Valid: ${certificate.isValid ? 'Yes' : 'No'}`);
      doc.moveDown();

      doc.fontSize(13).text('Pet Information', { underline: true });
      doc.fontSize(11);
      doc.text(`Name: ${certificate.pet.name}`);
      doc.text(`Species: ${certificate.pet.species}`);
      doc.text(`Breed: ${certificate.pet.breed ?? 'N/A'}`);
      doc.text(
        `Date of Birth: ${new Date(certificate.pet.dateOfBirth).toDateString()}`,
      );
      doc.text(`Microchip: ${certificate.pet.microchipNumber ?? 'N/A'}`);
      doc.moveDown();

      doc.fontSize(13).text('Vaccination Information', { underline: true });
      doc.fontSize(11);
      doc.text(`Vaccine: ${certificate.vaccination.vaccineName}`);
      doc.text(
        `Date Administered: ${new Date(certificate.vaccination.administeredDate).toDateString()}`,
      );
      doc.text(`Manufacturer: ${certificate.vaccination.manufacturer ?? 'N/A'}`);
      doc.text(`Batch Number: ${certificate.vaccination.batchNumber ?? 'N/A'}`);
      doc.text(`Site: ${certificate.vaccination.site ?? 'N/A'}`);
      doc.text(`Veterinarian: ${certificate.vaccination.veterinarianName}`);
      doc.moveDown();

      if (certificate.owner) {
        doc.fontSize(13).text('Owner Information', { underline: true });
        doc.fontSize(11);
        doc.text(`Name: ${certificate.owner.name}`);
        doc.text(`Email: ${certificate.owner.email}`);
        doc.moveDown();
      }

      if (certificate.vetClinic) {
        doc.fontSize(13).text('Clinic Information', { underline: true });
        doc.fontSize(11);
        doc.text(`Clinic: ${certificate.vetClinic.name}`);
        doc.text(`Address: ${certificate.vetClinic.address}`);
        doc.text(`Phone: ${certificate.vetClinic.phone}`);
        doc.moveDown();
      }

      doc
        .fontSize(10)
        .text(
          `Verification URL: ${certificate.verificationUrl}`,
          { align: 'left' },
        );

      doc.end();
    });
  }

  /**
   * Validate if a certificate is still valid
   */
  private validateCertificate(vaccination: Vaccination): boolean {
    // Check if vaccination has expiration date
    if (vaccination.expirationDate) {
      const expirationDate = new Date(vaccination.expirationDate);
      const now = new Date();
      return expirationDate >= now;
    }

    // If no expiration date, check if next due date has passed
    if (vaccination.nextDueDate) {
      const nextDueDate = new Date(vaccination.nextDueDate);
      const now = new Date();
      return nextDueDate >= now;
    }

    // Default to valid if no expiration info
    return true;
  }
}
