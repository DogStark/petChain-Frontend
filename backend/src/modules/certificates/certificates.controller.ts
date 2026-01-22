import { Controller, Get, Param } from '@nestjs/common';
import {
  CertificatesService,
  VaccinationCertificate,
} from './certificates.service';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

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
}
