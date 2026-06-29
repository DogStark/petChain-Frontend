import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QRCodesService } from './qrcodes.service';
import { QRCode } from './entities/qrcode.entity';
import { QRCodeScan } from './entities/qrcode-scan.entity';

const emptyRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn(), remove: jest.fn() };

function buildModule() {
  return Test.createTestingModule({
    providers: [
      QRCodesService,
      { provide: getRepositoryToken(QRCode), useValue: { ...emptyRepo } },
      { provide: getRepositoryToken(QRCodeScan), useValue: { ...emptyRepo } },
    ],
  }).compile();
}

describe('QRCodesService – boot validation', () => {
  const ORIGINAL = process.env.QR_ENCRYPTION_KEY;

  afterEach(() => {
    if (ORIGINAL !== undefined) {
      process.env.QR_ENCRYPTION_KEY = ORIGINAL;
    } else {
      delete process.env.QR_ENCRYPTION_KEY;
    }
  });

  it('throws when QR_ENCRYPTION_KEY is not set', async () => {
    delete process.env.QR_ENCRYPTION_KEY;
    await expect(buildModule()).rejects.toThrow('QR_ENCRYPTION_KEY');
  });

  it('starts successfully when QR_ENCRYPTION_KEY is set', async () => {
    process.env.QR_ENCRYPTION_KEY = 'test-key-32-chars-long-for-aes!!';
    const module = await buildModule();
    expect(module.get(QRCodesService)).toBeDefined();
  });
});
