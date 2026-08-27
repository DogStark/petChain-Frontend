import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DrugInteractionService, InteractionResult } from './drug-interaction.service';
import { DrugInteraction, InteractionSeverity } from '../entities/drug-interaction.entity';

const mockRepo = () => ({
  find: jest.fn(),
});

type MockRepo = ReturnType<typeof mockRepo>;

const mockMedication = (name: string) => ({
  id: `${name.toLowerCase()}-id`,
  name,
  genericName: name,
  brandNames: null,
});

const mockDbInteraction = (
  drug1: string,
  drug2: string,
  severity: InteractionSeverity,
  description: string,
): DrugInteraction => ({
  id: `${drug1}-${drug2}`,
  medicationId1: `${drug1.toLowerCase()}-id`,
  medication1: mockMedication(drug1) as any,
  medicationId2: `${drug2.toLowerCase()}-id`,
  medication2: mockMedication(drug2) as any,
  severity,
  description,
  mechanism: null,
  managementStrategies: null,
  symptoms: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('DrugInteractionService', () => {
  let service: DrugInteractionService;
  let repo: MockRepo;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrugInteractionService,
        {
          provide: getRepositoryToken(DrugInteraction),
          useFactory: mockRepo,
        },
      ],
    }).compile();

    service = module.get<DrugInteractionService>(DrugInteractionService);
    repo = module.get(getRepositoryToken(DrugInteraction));
  });

  describe('check()', () => {
    it('returns no interactions when medications do not conflict', async () => {
      repo.find.mockResolvedValue([]);

      const results = await service.check('Amoxicillin', ['Gabapentin']);
      expect(results).toEqual([]);
    });

    it('returns a MILD interaction from the static dataset', async () => {
      repo.find.mockResolvedValue([]);

      const results = await service.check('Amlodipine', ['Enalapril']);
      expect(results).toEqual([
        expect.objectContaining({
          drug1: 'Amlodipine',
          drug2: 'Enalapril',
          severity: 'MILD',
        }),
      ]);
    });

    it('returns a MODERATE interaction from the static dataset', async () => {
      repo.find.mockResolvedValue([]);

      const results = await service.check('Prednisone', ['Phenobarbital']);
      expect(results).toEqual([
        expect.objectContaining({
          drug1: 'Prednisone',
          drug2: 'Phenobarbital',
          severity: 'MODERATE',
        }),
      ]);
    });

    it('returns a SEVERE interaction from the static dataset', async () => {
      repo.find.mockResolvedValue([]);

      const results = await service.check('Carprofen', ['Aspirin']);
      expect(results).toEqual([
        expect.objectContaining({
          drug1: 'Carprofen',
          drug2: 'Aspirin',
          severity: 'SEVERE',
        }),
      ]);
    });

    it('returns a CONTRAINDICATED interaction from the static dataset', async () => {
      repo.find.mockResolvedValue([]);

      const results = await service.check('Carprofen', ['Meloxicam']);
      expect(results).toEqual([
        expect.objectContaining({
          drug1: 'Carprofen',
          drug2: 'Meloxicam',
          severity: 'CONTRAINDICATED',
        }),
      ]);
    });
  });

  describe('checkInteractions()', () => {
    it('returns all matching interactions for a medication list', async () => {
      repo.find.mockResolvedValue([
        mockDbInteraction(
          'Carprofen',
          'Aspirin',
          InteractionSeverity.SEVERE,
          'DB severity test',
        ),
      ]);

      const response = await service.checkInteractions([
        'Carprofen',
        'Aspirin',
      ]);

      expect(response.interactions).toEqual([
        expect.objectContaining({
          drug1: 'Carprofen',
          drug2: 'Aspirin',
          severity: 'SEVERE',
          description: 'DB severity test',
        }),
      ]);
    });
  });
});
