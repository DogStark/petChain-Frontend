import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecord, RecordType, AccessLevel } from './entities/medical-record.entity';
import { RecordTemplate } from './entities/record-template.entity';
import { RecordVersion } from './entities/record-version.entity';
import { AuditService } from '../audit/audit.service';
import { PetSpecies } from '../pets/entities/pet.entity';

// Mock qrcode module
jest.mock('qrcode', () => ({
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockqrcode'),
}));

describe('MedicalRecordsService', () => {
    let service: MedicalRecordsService;

    const mockMedicalRecordRepo = {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        softRemove: jest.fn(),
    };

    const mockTemplateRepo = {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
    };

    const mockVersionRepo = {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
    };

    const mockAuditService = {
        log: jest.fn().mockResolvedValue({}),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MedicalRecordsService,
                { provide: getRepositoryToken(MedicalRecord), useValue: mockMedicalRecordRepo },
                { provide: getRepositoryToken(RecordTemplate), useValue: mockTemplateRepo },
                { provide: getRepositoryToken(RecordVersion), useValue: mockVersionRepo },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<MedicalRecordsService>(MedicalRecordsService);
        jest.clearAllMocks();
    });

    // --- CREATE ---

    describe('create', () => {
        const dto = {
            petId: 'pet-1',
            vetId: 'vet-1',
            recordType: RecordType.CHECKUP,
            visitDate: '2026-02-21',
            diagnosis: 'Healthy',
            treatment: 'None',
            notes: 'Annual checkup',
        };

        it('should create a medical record, generate QR, and create version snapshot', async () => {
            const created = {
                id: 'rec-1',
                ...dto,
                verified: false,
                version: 1,
                qrCode: null,
            };
            const withQr = { ...created, qrCode: 'data:image/png;base64,mockqrcode' };
            const withRelations = { ...withQr, pet: { name: 'Buddy' }, vet: { vetName: 'Dr. Smith' } };

            mockMedicalRecordRepo.create.mockReturnValue(created);
            mockMedicalRecordRepo.save.mockResolvedValue(created);
            // findOne for QR generation, then for version snapshot, then for return
            mockMedicalRecordRepo.findOne
                .mockResolvedValueOnce(created)        // generateQRCode -> findOne
                .mockResolvedValueOnce(withQr)         // createVersionSnapshot -> findOne
                .mockResolvedValueOnce(withRelations); // final findOne

            mockVersionRepo.create.mockReturnValue({ id: 'v-1', recordId: 'rec-1', version: 1 });
            mockVersionRepo.save.mockResolvedValue({ id: 'v-1', recordId: 'rec-1', version: 1 });

            const result = await service.create(dto, 'user-1');

            expect(mockMedicalRecordRepo.create).toHaveBeenCalledWith(dto);
            expect(mockMedicalRecordRepo.save).toHaveBeenCalled();
            expect(mockVersionRepo.create).toHaveBeenCalled();
            expect(mockAuditService.log).toHaveBeenCalledWith(
                'user-1', 'medical_record', 'rec-1', 'create',
            );
            expect(result.pet).toBeDefined();
        });

        it('should create record without userId (no audit log)', async () => {
            const created = { id: 'rec-2', ...dto, verified: false, version: 1, qrCode: null };
            mockMedicalRecordRepo.create.mockReturnValue(created);
            mockMedicalRecordRepo.save.mockResolvedValue(created);
            mockMedicalRecordRepo.findOne.mockResolvedValue(created);
            mockVersionRepo.create.mockReturnValue({ id: 'v-1' });
            mockVersionRepo.save.mockResolvedValue({ id: 'v-1' });

            await service.create(dto);

            expect(mockAuditService.log).not.toHaveBeenCalled();
        });
    });

    // --- FIND ALL ---

    describe('findAll', () => {
        it('should return records filtered by petId', async () => {
            const records = [{ id: 'rec-1', petId: 'pet-1' }];
            mockMedicalRecordRepo.find.mockResolvedValue(records);

            const result = await service.findAll('pet-1');

            expect(mockMedicalRecordRepo.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { petId: 'pet-1' },
                    relations: ['pet', 'vet', 'verifiedByVet'],
                    order: { visitDate: 'DESC' },
                }),
            );
            expect(result).toEqual(records);
        });

        it('should return records filtered by recordType', async () => {
            mockMedicalRecordRepo.find.mockResolvedValue([]);

            await service.findAll(undefined, RecordType.SURGERY);

            expect(mockMedicalRecordRepo.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { recordType: RecordType.SURGERY },
                }),
            );
        });

        it('should filter by date range using visitDate', async () => {
            mockMedicalRecordRepo.find.mockResolvedValue([]);

            await service.findAll(undefined, undefined, '2026-01-01', '2026-12-31');

            const call = mockMedicalRecordRepo.find.mock.calls[0][0];
            expect(call.where.visitDate).toBeDefined();
        });

        it('should return all records when no filters provided', async () => {
            const records = [{ id: 'rec-1' }, { id: 'rec-2' }];
            mockMedicalRecordRepo.find.mockResolvedValue(records);

            const result = await service.findAll();

            expect(result).toHaveLength(2);
        });
    });

    // --- FIND ONE ---

    describe('findOne', () => {
        it('should return a record by id', async () => {
            const record = { id: 'rec-1', pet: { name: 'Buddy' }, vet: { vetName: 'Dr. Smith' } };
            mockMedicalRecordRepo.findOne.mockResolvedValue(record);

            const result = await service.findOne('rec-1');

            expect(result).toEqual(record);
            expect(mockMedicalRecordRepo.findOne).toHaveBeenCalledWith({
                where: { id: 'rec-1' },
                relations: ['pet', 'vet', 'verifiedByVet'],
            });
        });

        it('should throw NotFoundException if record not found', async () => {
            mockMedicalRecordRepo.findOne.mockResolvedValue(null);

            await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });

    // --- FIND BY IDS ---

    describe('findByIds', () => {
        it('should return records matching ids', async () => {
            const records = [{ id: 'rec-1' }, { id: 'rec-2' }];
            mockMedicalRecordRepo.find.mockResolvedValue(records);

            const result = await service.findByIds(['rec-1', 'rec-2']);

            expect(result).toHaveLength(2);
        });

        it('should return empty array for empty ids', async () => {
            const result = await service.findByIds([]);

            expect(result).toEqual([]);
        });
    });

    // --- UPDATE ---

    describe('update', () => {
        it('should update a non-verified record and create version snapshot', async () => {
            const existing = {
                id: 'rec-1',
                verified: false,
                version: 1,
                diagnosis: 'Old diagnosis',
            };
            mockMedicalRecordRepo.findOne
                .mockResolvedValueOnce(existing)   // findOne in update
                .mockResolvedValueOnce(existing);  // findOne in createVersionSnapshot
            mockVersionRepo.create.mockReturnValue({ id: 'v-2', version: 1 });
            mockVersionRepo.save.mockResolvedValue({ id: 'v-2', version: 1 });
            mockMedicalRecordRepo.save.mockResolvedValue({
                ...existing,
                diagnosis: 'New diagnosis',
                version: 2,
            });

            const result = await service.update('rec-1', {
                diagnosis: 'New diagnosis',
                changeReason: 'Updated diagnosis after lab results',
            }, 'user-1');

            expect(result.diagnosis).toBe('New diagnosis');
            expect(mockVersionRepo.create).toHaveBeenCalled();
            expect(mockAuditService.log).toHaveBeenCalledWith(
                'user-1', 'medical_record', 'rec-1', 'update',
            );
        });

        it('should throw ForbiddenException when updating a verified record', async () => {
            const verified = { id: 'rec-1', verified: true, version: 2 };
            mockMedicalRecordRepo.findOne.mockResolvedValue(verified);

            await expect(
                service.update('rec-1', { diagnosis: 'Changed' }),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    // --- REMOVE ---

    describe('remove', () => {
        it('should soft remove a non-verified record', async () => {
            const record = { id: 'rec-1', verified: false };
            mockMedicalRecordRepo.findOne.mockResolvedValue(record);
            mockMedicalRecordRepo.softRemove.mockResolvedValue(record);

            await service.remove('rec-1', 'user-1');

            expect(mockMedicalRecordRepo.softRemove).toHaveBeenCalledWith(record);
            expect(mockAuditService.log).toHaveBeenCalledWith(
                'user-1', 'medical_record', 'rec-1', 'delete',
            );
        });

        it('should throw ForbiddenException when deleting a verified record', async () => {
            const verified = { id: 'rec-1', verified: true };
            mockMedicalRecordRepo.findOne.mockResolvedValue(verified);

            await expect(service.remove('rec-1')).rejects.toThrow(ForbiddenException);
        });

        it('should throw NotFoundException when record does not exist', async () => {
            mockMedicalRecordRepo.findOne.mockResolvedValue(null);

            await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });

    // --- VERIFY RECORD ---

    describe('verifyRecord', () => {
        const verifyDto = {
            vetId: 'vet-1',
            digitalSignature: 'sig-data-123',
        };

        it('should verify a record with digital signature hash', async () => {
            const record = {
                id: 'rec-1',
                petId: 'pet-1',
                vetId: 'vet-1',
                diagnosis: 'Healthy',
                treatment: 'None',
                visitDate: '2026-02-21',
                verified: false,
                verifiedAt: null,
                verifiedByVetId: null,
                digitalSignature: null,
                notes: null,
            };
            mockMedicalRecordRepo.findOne.mockResolvedValue(record);
            mockMedicalRecordRepo.save.mockImplementation((r) => Promise.resolve(r));

            const result = await service.verifyRecord('rec-1', verifyDto, 'user-1');

            expect(result.verified).toBe(true);
            expect(result.verifiedAt).toBeInstanceOf(Date);
            expect(result.verifiedByVetId).toBe('vet-1');
            expect(result.digitalSignature).toBeDefined();
            expect(result.digitalSignature).toHaveLength(64); // SHA-256 hex
            expect(mockAuditService.log).toHaveBeenCalled();
        });

        it('should append verification notes to existing notes', async () => {
            const record = {
                id: 'rec-1',
                petId: 'pet-1',
                vetId: 'vet-1',
                diagnosis: 'Test',
                treatment: 'Test',
                visitDate: '2026-02-21',
                verified: false,
                verifiedAt: null,
                verifiedByVetId: null,
                digitalSignature: null,
                notes: 'Existing notes',
            };
            mockMedicalRecordRepo.findOne.mockResolvedValue(record);
            mockMedicalRecordRepo.save.mockImplementation((r) => Promise.resolve(r));

            const result = await service.verifyRecord('rec-1', {
                ...verifyDto,
                notes: 'All looks good',
            });

            expect(result.notes).toContain('Existing notes');
            expect(result.notes).toContain('[Verification Note]: All looks good');
        });

        it('should throw BadRequestException if already verified', async () => {
            const record = { id: 'rec-1', verified: true };
            mockMedicalRecordRepo.findOne.mockResolvedValue(record);

            await expect(
                service.verifyRecord('rec-1', verifyDto),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // --- REVOKE VERIFICATION ---

    describe('revokeVerification', () => {
        const revokeDto = {
            vetId: 'vet-1',
            reason: 'Incorrect diagnosis',
        };

        it('should revoke verification and create version snapshot', async () => {
            const record = {
                id: 'rec-1',
                verified: true,
                verifiedAt: new Date(),
                verifiedByVetId: 'vet-1',
                digitalSignature: 'hash-abc',
                version: 2,
            };
            mockMedicalRecordRepo.findOne
                .mockResolvedValueOnce(record)   // findOne in revokeVerification
                .mockResolvedValueOnce(record);  // findOne in createVersionSnapshot
            mockVersionRepo.create.mockReturnValue({ id: 'v-3' });
            mockVersionRepo.save.mockResolvedValue({ id: 'v-3' });
            mockMedicalRecordRepo.save.mockImplementation((r) => Promise.resolve(r));

            const result = await service.revokeVerification('rec-1', revokeDto, 'user-1');

            expect(result.verified).toBe(false);
            expect(result.verifiedAt).toBeNull();
            expect(result.verifiedByVetId).toBeNull();
            expect(result.digitalSignature).toBeNull();
            expect(mockVersionRepo.create).toHaveBeenCalled();
            expect(mockAuditService.log).toHaveBeenCalled();
        });

        it('should throw BadRequestException if not currently verified', async () => {
            const record = { id: 'rec-1', verified: false };
            mockMedicalRecordRepo.findOne.mockResolvedValue(record);

            await expect(
                service.revokeVerification('rec-1', revokeDto),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // --- VERSION HISTORY ---

    describe('getRecordVersions', () => {
        it('should return version history for a record', async () => {
            const record = { id: 'rec-1' };
            const versions = [
                { id: 'v-2', recordId: 'rec-1', version: 2 },
                { id: 'v-1', recordId: 'rec-1', version: 1 },
            ];
            mockMedicalRecordRepo.findOne.mockResolvedValue(record);
            mockVersionRepo.find.mockResolvedValue(versions);

            const result = await service.getRecordVersions('rec-1');

            expect(result).toHaveLength(2);
            expect(mockVersionRepo.find).toHaveBeenCalledWith({
                where: { recordId: 'rec-1' },
                order: { version: 'DESC' },
            });
        });

        it('should throw NotFoundException if record not found', async () => {
            mockMedicalRecordRepo.findOne.mockResolvedValue(null);

            await expect(service.getRecordVersions('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('getRecordVersion', () => {
        it('should return a specific version', async () => {
            const version = { id: 'v-1', recordId: 'rec-1', version: 1, snapshot: {} };
            mockVersionRepo.findOne.mockResolvedValue(version);

            const result = await service.getRecordVersion('rec-1', 'v-1');

            expect(result).toEqual(version);
        });

        it('should throw NotFoundException if version not found', async () => {
            mockVersionRepo.findOne.mockResolvedValue(null);

            await expect(
                service.getRecordVersion('rec-1', 'nonexistent'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // --- TEMPLATES ---

    describe('getTemplatesByPetType', () => {
        it('should return active templates for a pet type', async () => {
            const templates = [
                { id: 't-1', petType: PetSpecies.DOG, recordType: RecordType.CHECKUP, isActive: true },
            ];
            mockTemplateRepo.find.mockResolvedValue(templates);

            const result = await service.getTemplatesByPetType(PetSpecies.DOG);

            expect(mockTemplateRepo.find).toHaveBeenCalledWith({
                where: { petType: PetSpecies.DOG, isActive: true },
            });
            expect(result).toEqual(templates);
        });
    });

    describe('createTemplate', () => {
        it('should create a new record template', async () => {
            const templateData = {
                petType: PetSpecies.CAT,
                recordType: RecordType.CHECKUP,
                templateFields: { weight: 'number', temperature: 'number' },
                description: 'Cat checkup template',
            };
            const created = { id: 't-1', ...templateData, isActive: true };
            mockTemplateRepo.create.mockReturnValue(created);
            mockTemplateRepo.save.mockResolvedValue(created);

            const result = await service.createTemplate(
                templateData.petType,
                templateData.recordType,
                templateData.templateFields,
                templateData.description,
            );

            expect(mockTemplateRepo.create).toHaveBeenCalledWith({
                petType: PetSpecies.CAT,
                recordType: RecordType.CHECKUP,
                templateFields: { weight: 'number', temperature: 'number' },
                description: 'Cat checkup template',
            });
            expect(result).toEqual(created);
        });
    });

    // --- QR CODE ---

    describe('getQRCode', () => {
        it('should return existing QR code', async () => {
            const record = { id: 'rec-1', qrCode: 'data:image/png;base64,existing' };
            mockMedicalRecordRepo.findOne.mockResolvedValue(record);

            const result = await service.getQRCode('rec-1');

            expect(result).toBe('data:image/png;base64,existing');
        });

        it('should generate QR code if not present', async () => {
            const record = { id: 'rec-1', qrCode: null };
            const withQr = { ...record, qrCode: 'data:image/png;base64,mockqrcode' };
            mockMedicalRecordRepo.findOne
                .mockResolvedValueOnce(record)  // getQRCode -> findOne
                .mockResolvedValueOnce(record); // generateQRCode -> findOne
            mockMedicalRecordRepo.save.mockResolvedValue(withQr);

            const result = await service.getQRCode('rec-1');

            expect(result).toBe('data:image/png;base64,mockqrcode');
        });
    });

    // --- ATTACHMENTS ---

    describe('saveAttachment', () => {
        it('should save a valid attachment and return filepath', async () => {
            const file = {
                originalname: 'xray.jpg',
                mimetype: 'image/jpeg',
                size: 1024 * 100, // 100KB
            } as Express.Multer.File;

            const result = await service.saveAttachment(file);

            expect(result).toContain('uploads/medical-records/');
            expect(result).toContain('xray.jpg');
        });

        it('should reject disallowed file types', async () => {
            const file = {
                originalname: 'script.exe',
                mimetype: 'application/x-executable',
                size: 1024,
            } as Express.Multer.File;

            await expect(service.saveAttachment(file)).rejects.toThrow(BadRequestException);
        });

        it('should reject files exceeding size limit', async () => {
            const file = {
                originalname: 'large-image.png',
                mimetype: 'image/png',
                size: 60 * 1024 * 1024, // 60MB
            } as Express.Multer.File;

            await expect(service.saveAttachment(file)).rejects.toThrow(BadRequestException);
        });
    });
});
