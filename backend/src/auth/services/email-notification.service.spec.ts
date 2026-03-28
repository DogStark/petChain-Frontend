import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailNotificationService } from './email-notification.service';

jest.mock('nodemailer');

describe('EmailNotificationService', () => {
  let service: EmailNotificationService;
  let sendMail: jest.Mock;

  beforeEach(async () => {
    sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailNotificationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                EMAIL_HOST: 'smtp.example.com',
                EMAIL_PORT: '587',
                EMAIL_USER: 'u',
                EMAIL_PASS: 'p',
                EMAIL_FROM: 'from@test.com',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(EmailNotificationService);
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  it('builds plain-text reset template and sends', async () => {
    await service.sendPasswordResetEmail(
      'to@test.com',
      'http://x/reset?token=t',
      60,
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'to@test.com',
        text: expect.stringContaining('http://x/reset?token=t'),
      }),
    );
  });

  it('swallows SMTP errors', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'));
    await expect(
      service.sendPasswordResetConfirmationEmail('to@test.com'),
    ).resolves.toBeUndefined();
  });

  it('skips send when SMTP not configured', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        EmailNotificationService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();
    const s = mod.get(EmailNotificationService);
    await s.sendAccountLockedEmail('to@test.com', new Date());
    expect(sendMail).not.toHaveBeenCalled();
  });
});
