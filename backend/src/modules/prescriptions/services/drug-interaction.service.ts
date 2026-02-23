import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DrugInteraction } from '../entities/drug-interaction.entity';

@Injectable()
export class DrugInteractionService {
  constructor(
    @InjectRepository(DrugInteraction)
    private readonly drugInteractionRepository: Repository<DrugInteraction>,
  ) {}

  async checkInteractions(medicationNames: string[]): Promise<{ interactions: DrugInteraction[] }> {
    if (!medicationNames?.length) return { interactions: [] };
    const interactions = await this.drugInteractionRepository.find({
      where: { isActive: true },
      relations: ['medication1', 'medication2'],
    });
    return { interactions };
  }

  async getInteractionsByMedication(medicationId: string): Promise<DrugInteraction[]> {
    return this.drugInteractionRepository.find({
      where: [{ medicationId1: medicationId }, { medicationId2: medicationId }],
      relations: ['medication1', 'medication2'],
    });
  }
}
