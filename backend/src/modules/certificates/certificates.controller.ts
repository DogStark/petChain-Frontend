import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import {
  CertificatesService,
  VaccinationCertificate,
} from './certificates.service';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  /**
   * Get all certificates for a pet
   * GET /certificates/pet/:petId
   */
  @Get('pet/:petId')
  async getCertificatesForPet(
    @Param('petId') petId: string,
  ): Promise<VaccinationCertificate[]> {
    return await this.certificatesService.getCertificatesForPet(petId);
  }

  /**
   * Verify a certificate by code
   * GET /certificates/verify/:code
   */
  @Get('verify/:code')
  async verifyCertificate(@Param('code') code: string) {
    return await this.certificatesService.verifyCertificate(code);
  }

  /**
   * Download certificate as PDF
   * GET /certificates/:vaccinationId/pdf
   */
  @Get(':vaccinationId/pdf')
  async downloadCertificatePdf(
    @Param('vaccinationId') vaccinationId: string,
  ): Promise<StreamableFile> {
    const buffer =
      await this.certificatesService.generateCertificatePdf(vaccinationId);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="vaccination-certificate-${vaccinationId}.pdf"`,
    });
  }

  /**
   * Get certificate by vaccination ID
   * GET /certificates/:vaccinationId
   */
  @Get(':vaccinationId')
  async getCertificate(
    @Param('vaccinationId') vaccinationId: string,
  ): Promise<VaccinationCertificate> {
    return await this.certificatesService.getCertificateByVaccination(
      vaccinationId,
    );
  }
}
