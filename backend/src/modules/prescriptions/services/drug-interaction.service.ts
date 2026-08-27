import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DrugInteraction,
  InteractionSeverity,
} from '../entities/drug-interaction.entity';

export interface InteractionResult {
  drug1: string;
  drug2: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'CONTRAINDICATED';
  description: string;
}

interface StaticInteractionEntry {
  drug1: string;
  drug2: string;
  severity: InteractionSeverity;
  description: string;
}

const STATIC_DRUG_INTERACTIONS: StaticInteractionEntry[] = [
  {
    drug1: 'Carprofen',
    drug2: 'Meloxicam',
    severity: InteractionSeverity.CONTRAINDICATED,
    description:
      'Concurrent NSAIDs significantly increase gastrointestinal and renal toxicity risk. Avoid unless under strict veterinary supervision.',
  },
  {
    drug1: 'Carprofen',
    drug2: 'Aspirin',
    severity: InteractionSeverity.SEVERE,
    description:
      'Dual NSAID therapy increases the risk of GI ulceration and kidney damage. Do not combine without a compelling indication.',
  },
  {
    drug1: 'Meloxicam',
    drug2: 'Prednisone',
    severity: InteractionSeverity.SEVERE,
    description:
      'NSAIDs combined with corticosteroids markedly raise the risk of gastrointestinal irritation and ulceration.',
  },
  {
    drug1: 'Phenobarbital',
    drug2: 'Potassium Bromide',
    severity: InteractionSeverity.MODERATE,
    description:
      'Sedative effects may be additive and require dose adjustment and close monitoring.',
  },
  {
    drug1: 'Phenobarbital',
    drug2: 'Metronidazole',
    severity: InteractionSeverity.MODERATE,
    description:
      'Phenobarbital may accelerate metronidazole metabolism, reducing therapeutic exposure.',
  },
  {
    drug1: 'Prednisone',
    drug2: 'Phenobarbital',
    severity: InteractionSeverity.MODERATE,
    description:
      'Corticosteroids and anticonvulsants may interact through hepatic enzyme induction and require monitoring.',
  },
  {
    drug1: 'Tramadol',
    drug2: 'Fluoxetine',
    severity: InteractionSeverity.MODERATE,
    description:
      'Combined serotonergic drugs can increase the risk of serotonin syndrome. Monitor behavior and neurologic status.',
  },
  {
    drug1: 'Trazodone',
    drug2: 'Fluoxetine',
    severity: InteractionSeverity.MODERATE,
    description:
      'Concurrent serotonergic medications may increase sedation and serotonin-related adverse effects.',
  },
  {
    drug1: 'Enrofloxacin',
    drug2: 'Sucralfate',
    severity: InteractionSeverity.MILD,
    description:
      'Sucralfate can reduce absorption of fluoroquinolones if administered too closely together.',
  },
  {
    drug1: 'Enalapril',
    drug2: 'Furosemide',
    severity: InteractionSeverity.MODERATE,
    description:
      'ACE inhibitors and loop diuretics require blood pressure and kidney function monitoring.',
  },
  {
    drug1: 'Amlodipine',
    drug2: 'Sildenafil',
    severity: InteractionSeverity.MODERATE,
    description:
      'Both drugs may lower blood pressure and require close cardiovascular monitoring.',
  },
  {
    drug1: 'Ciprofloxacin',
    drug2: 'Theophylline',
    severity: InteractionSeverity.SEVERE,
    description:
      'Fluoroquinolones can reduce the clearance of theophylline, raising the risk of toxicity.',
  },
  {
    drug1: 'Ketoconazole',
    drug2: 'Cyclosporine',
    severity: InteractionSeverity.SEVERE,
    description:
      'Ketoconazole inhibits cyclosporine metabolism and may cause dangerously elevated cyclosporine levels.',
  },
  {
    drug1: 'Amlodipine',
    drug2: 'Enalapril',
    severity: InteractionSeverity.MILD,
    description:
      'These antihypertensive agents can be used together with monitoring for low blood pressure.',
  },
  {
    drug1: 'Doxycycline',
    drug2: 'Calcium Carbonate',
    severity: InteractionSeverity.SEVERE,
    description:
      'Calcium-containing antacids can prevent absorption of doxycycline, reducing its effectiveness.',
  },
  {
    drug1: 'Chloramphenicol',
    drug2: 'Cyclosporine',
    severity: InteractionSeverity.SEVERE,
    description:
      'Chloramphenicol may inhibit cyclosporine metabolism, increasing immunosuppressive toxicity.',
  },
  {
    drug1: 'Amoxicillin',
    drug2: 'Doxycycline',
    severity: InteractionSeverity.MILD,
    description:
      'Concurrent antibiotic therapy can be used carefully, but watch for additive gastrointestinal upset.',
  },
  {
    drug1: 'Carprofen',
    drug2: 'Gabapentin',
    severity: InteractionSeverity.MILD,
    description:
      'This combination is generally acceptable, but monitor for sedation and gastrointestinal effects.',
  },
  {
    drug1: 'Warfarin',
    drug2: 'Aspirin',
    severity: InteractionSeverity.CONTRAINDICATED,
    description:
      'Anticoagulants combined with aspirin can dramatically increase bleeding risk. Avoid unless explicitly directed by a veterinarian.',
  },
  {
    drug1: 'Metronidazole',
    drug2: 'Amoxicillin',
    severity: InteractionSeverity.MILD,
    description:
      'This antibiotic combination is usually safe but may increase gastrointestinal adverse effects.',
  },
];

@Injectable()
export class DrugInteractionService {
  private readonly logger = new Logger(DrugInteractionService.name);

  constructor(
    @InjectRepository(DrugInteraction)
    private readonly drugInteractionRepository: Repository<DrugInteraction>,
  ) {}

  async check(
    newMedication: string,
    existingMedications: string[],
  ): Promise<InteractionResult[]> {
    if (!newMedication?.trim() || !existingMedications?.length) {
      return [];
    }

    const medicationNames = [newMedication, ...existingMedications];
    const allMatches = await this.findInteractions(medicationNames);
    return allMatches.filter((result) =>
      this.isMedicationInResult(result, newMedication),
    );
  }

  async checkInteractions(
    medicationNames: string[],
  ): Promise<{ interactions: InteractionResult[] }> {
    if (!medicationNames?.length) return { interactions: [] };
    const interactions = await this.findInteractions(medicationNames);
    return { interactions };
  }

  async getInteractionsByMedication(
    medicationId: string,
  ): Promise<DrugInteraction[]> {
    return this.drugInteractionRepository.find({
      where: [{ medicationId1: medicationId }, { medicationId2: medicationId }],
      relations: ['medication1', 'medication2'],
    });
  }

  private normalizeName(value: string): string {
    return (value || '').trim().toLowerCase();
  }

  private isMedicationInResult(
    result: InteractionResult,
    medication: string,
  ): boolean {
    const normalized = this.normalizeName(medication);
    return (
      this.normalizeName(result.drug1) === normalized ||
      this.normalizeName(result.drug2) === normalized
    );
  }

  private async findInteractions(
    medicationNames: string[],
  ): Promise<InteractionResult[]> {
    const normalizedNames = medicationNames
      .map((name) => this.normalizeName(name))
      .filter(Boolean);

    if (normalizedNames.length < 2) {
      return [];
    }

    const dbInteractions = await this.drugInteractionRepository.find({
      where: { isActive: true },
      relations: ['medication1', 'medication2'],
    });

    const normalizedSet = new Set(normalizedNames);
    const results: InteractionResult[] = [];

    for (const interaction of dbInteractions) {
      const name1 = this.normalizeName(interaction.medication1?.name);
      const name2 = this.normalizeName(interaction.medication2?.name);

      if (normalizedSet.has(name1) && normalizedSet.has(name2)) {
        results.push(this.mapDbInteractionToResult(interaction));
      }
    }

    for (const interaction of STATIC_DRUG_INTERACTIONS) {
      const name1 = this.normalizeName(interaction.drug1);
      const name2 = this.normalizeName(interaction.drug2);

      if (normalizedSet.has(name1) && normalizedSet.has(name2)) {
        results.push({
          drug1: interaction.drug1,
          drug2: interaction.drug2,
          severity: interaction.severity.toUpperCase() as InteractionResult['severity'],
          description: interaction.description,
        });
      }
    }

    return this.mergeInteractions(results);
  }

  private mapDbInteractionToResult(
    interaction: DrugInteraction,
  ): InteractionResult {
    return {
      drug1: interaction.medication1?.name,
      drug2: interaction.medication2?.name,
      severity: interaction.severity.toUpperCase() as InteractionResult['severity'],
      description: interaction.description,
    };
  }

  private mergeInteractions(
    interactions: InteractionResult[],
  ): InteractionResult[] {
    const merged = new Map<string, InteractionResult>();

    for (const interaction of interactions) {
      const key = this.getInteractionKey(interaction.drug1, interaction.drug2);
      const existing = merged.get(key);

      if (
        !existing ||
        this.getSeverityRank(interaction.severity) >
          this.getSeverityRank(existing.severity)
      ) {
        merged.set(key, interaction);
      }
    }

    return Array.from(merged.values());
  }

  private getInteractionKey(drug1: string, drug2: string): string {
    const normalized1 = this.normalizeName(drug1);
    const normalized2 = this.normalizeName(drug2);
    return [normalized1, normalized2].sort().join('|');
  }

  private getSeverityRank(severity: InteractionResult['severity']): number {
    switch (severity) {
      case 'CONTRAINDICATED':
        return 4;
      case 'SEVERE':
        return 3;
      case 'MODERATE':
        return 2;
      default:
        return 1;
    }
  }
}
