import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Prescription } from './entities/prescription.entity';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
  ) {}

  async create(
    createPrescriptionDto: CreatePrescriptionDto,
  ): Promise<Prescription> {
    const prescription =
      this.prescriptionRepository.create(createPrescriptionDto);
    return await this.prescriptionRepository.save(prescription);
  }

  async findAll(petId?: string): Promise<Prescription[]> {
    const where: any = {};
    if (petId) {
      where.petId = petId;
    }

    return await this.prescriptionRepository.find({
      where,
      relations: ['pet', 'vet'],
      order: { startDate: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['pet', 'vet'],
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    return prescription;
  }

  async update(
    id: string,
    updatePrescriptionDto: UpdatePrescriptionDto,
  ): Promise<Prescription> {
    const prescription = await this.findOne(id);
    Object.assign(prescription, updatePrescriptionDto);
    return await this.prescriptionRepository.save(prescription);
  }

  async remove(id: string): Promise<void> {
    const prescription = await this.findOne(id);
    await this.prescriptionRepository.remove(prescription);
  }

  async getActivePrescriptions(petId: string): Promise<Prescription[]> {
    const today = new Date();

    return await this.prescriptionRepository.find({
      where: {
        petId,
        startDate: LessThanOrEqual(today),
        endDate: MoreThanOrEqual(today),
      },
      relations: ['pet', 'vet'],
      order: { startDate: 'DESC' },
    });
  }

  async getExpiredPrescriptions(petId: string): Promise<Prescription[]> {
    const today = new Date();

    return await this.prescriptionRepository.find({
      where: {
        petId,
        endDate: LessThanOrEqual(today),
      },
      relations: ['pet', 'vet'],
      order: { endDate: 'DESC' },
    });
  }
}
