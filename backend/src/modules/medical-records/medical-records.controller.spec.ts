import { Test, TestingModule } from '@nestjs/testing';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsExportService } from './medical-records-export.service';
import { RecordType } from './entities/medical-record.entity';
import { PetSpecies } from '../pets/entities/pet.entity';

describe('MedicalRecordsController', () => {
    let controller: MedicalRecordsController;

    const mockService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        verifyRecord: jest.fn(),
        revokeVerification: jest.fn(),
        getRecordVersions: jest.fn(),
        getRecordVersion: jest.fn(),
        getQRCode: jest.fn(),
        getTemplatesByPetType: jest.fn(),
        createTemplate: jest.fn(),
        saveAttachment: jest.fn(),
    };

    const mockExportService = {
        export: jest.fn(),
        sendExportByEmail: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MedicalRecordsController],
            providers: [
                { provide: MedicalRecordsService, useValue: mockService },
                { provide: MedicalRecordsExportService, useValue: mockExportService },
            ],
        }).compile();

        controller = module.get<MedicalRecordsController>(MedicalRecordsController);
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a medical record', async () => {
            const dto = {
                petId: 'pet-1',
                recordType: RecordType.CHECKUP,
                visitDate: '2026-02-21',
                diagnosis: 'Healthy',
                treatment: 'None',
            };
            const result = { id: 'rec-1', ...dto };
            mockService.create.mockResolvedValue(result);

            expect(await controller.create(dto)).toEqual(result);
            expect(mockService.create).toHaveBeenCalledWith(dto);
        });

        it('should handle file uploads on create', async () => {
            const dto = {
                petId: 'pet-1',
                recordType: RecordType.CHECKUP,
                visitDate: '2026-02-21',
                diagnosis: 'Healthy',
                treatment: 'None',
            };
            const files = [
                { originalname: 'xray.jpg', mimetype: 'image/jpeg', size: 100 },
            ] as Express.Multer.File[];
            mockService.saveAttachment.mockResolvedValue('uploads/medical-records/uuid-xray.jpg');
            mockService.create.mockResolvedValue({ id: 'rec-1', ...dto, attachments: ['uploads/medical-records/uuid-xray.jpg'] });

            const result = await controller.create(dto, files);

            expect(mockService.saveAttachment).toHaveBeenCalledWith(files[0]);
            expect(result.attachments).toHaveLength(1);
        });
    });

    describe('findAll', () => {
        it('should return all records', async () => {
            const records = [{ id: 'rec-1' }, { id: 'rec-2' }];
            mockService.findAll.mockResolvedValue(records);

            const result = await controller.findAll();

            expect(result).toHaveLength(2);
            expect(mockService.findAll).toHaveBeenCalledWith(
                undefined, undefined, undefined, undefined,
            );
        });

        it('should pass query filters to service', async () => {
            mockService.findAll.mockResolvedValue([]);

            await controller.findAll('pet-1', RecordType.SURGERY, '2026-01-01', '2026-12-31');

            expect(mockService.findAll).toHaveBeenCalledWith(
                'pet-1', RecordType.SURGERY, '2026-01-01', '2026-12-31',
            );
        });
    });

    describe('findOne', () => {
        it('should return a single record', async () => {
            const record = { id: 'rec-1', diagnosis: 'Healthy' };
            mockService.findOne.mockResolvedValue(record);

            expect(await controller.findOne('rec-1')).toEqual(record);
        });
    });

    describe('update', () => {
        it('should update and return the record', async () => {
            const updated = { id: 'rec-1', diagnosis: 'Updated' };
            mockService.update.mockResolvedValue(updated);

            const result = await controller.update('rec-1', { diagnosis: 'Updated' });

            expect(result).toEqual(updated);
            expect(mockService.update).toHaveBeenCalledWith('rec-1', { diagnosis: 'Updated' });
        });
    });

    describe('remove', () => {
        it('should remove a record', async () => {
            mockService.remove.mockResolvedValue(undefined);

            await controller.remove('rec-1');

            expect(mockService.remove).toHaveBeenCalledWith('rec-1');
        });
    });

    // --- Verification ---

    describe('verifyRecord', () => {
        it('should verify a record', async () => {
            const verifyDto = { vetId: 'vet-1', digitalSignature: 'sig-123' };
            const verified = { id: 'rec-1', verified: true, verifiedByVetId: 'vet-1' };
            mockService.verifyRecord.mockResolvedValue(verified);

            const result = await controller.verifyRecord('rec-1', verifyDto);

            expect(result.verified).toBe(true);
            expect(mockService.verifyRecord).toHaveBeenCalledWith('rec-1', verifyDto);
        });
    });

    describe('revokeVerification', () => {
        it('should revoke verification', async () => {
            const revokeDto = { vetId: 'vet-1', reason: 'Error found' };
            const revoked = { id: 'rec-1', verified: false };
            mockService.revokeVerification.mockResolvedValue(revoked);

            const result = await controller.revokeVerification('rec-1', revokeDto);

            expect(result.verified).toBe(false);
            expect(mockService.revokeVerification).toHaveBeenCalledWith('rec-1', revokeDto);
        });
    });

    // --- Versioning ---

    describe('getVersions', () => {
        it('should return version history', async () => {
            const versions = [
                { id: 'v-2', version: 2 },
                { id: 'v-1', version: 1 },
            ];
            mockService.getRecordVersions.mockResolvedValue(versions);

            const result = await controller.getVersions('rec-1');

            expect(result).toHaveLength(2);
            expect(mockService.getRecordVersions).toHaveBeenCalledWith('rec-1');
        });
    });

    describe('getVersion', () => {
        it('should return a specific version', async () => {
            const version = { id: 'v-1', version: 1, snapshot: {} };
            mockService.getRecordVersion.mockResolvedValue(version);

            const result = await controller.getVersion('rec-1', 'v-1');

            expect(result).toEqual(version);
            expect(mockService.getRecordVersion).toHaveBeenCalledWith('rec-1', 'v-1');
        });
    });

    // --- Templates ---

    describe('getTemplates', () => {
        it('should return templates for a pet type', async () => {
            const templates = [{ id: 't-1', petType: PetSpecies.DOG }];
            mockService.getTemplatesByPetType.mockResolvedValue(templates);

            const result = await controller.getTemplates(PetSpecies.DOG);

            expect(result).toEqual(templates);
            expect(mockService.getTemplatesByPetType).toHaveBeenCalledWith(PetSpecies.DOG);
        });
    });

    describe('createTemplate', () => {
        it('should create a new template', async () => {
            const created = {
                id: 't-1',
                petType: PetSpecies.CAT,
                recordType: RecordType.CHECKUP,
                templateFields: { weight: 'number' },
            };
            mockService.createTemplate.mockResolvedValue(created);

            const result = await controller.createTemplate(
                PetSpecies.CAT,
                RecordType.CHECKUP,
                { weight: 'number' },
                'Cat checkup',
            );

            expect(result).toEqual(created);
            expect(mockService.createTemplate).toHaveBeenCalledWith(
                PetSpecies.CAT,
                RecordType.CHECKUP,
                { weight: 'number' },
                'Cat checkup',
            );
        });
    });

    // --- QR Code ---

    describe('getQRCode', () => {
        it('should return QR code for a record', async () => {
            mockService.getQRCode.mockResolvedValue('data:image/png;base64,qr');

            const result = await controller.getQRCode('rec-1');

            expect(result).toBe('data:image/png;base64,qr');
        });
    });
});
