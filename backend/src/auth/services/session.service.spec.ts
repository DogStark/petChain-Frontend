import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionService } from './session.service';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Session } from '../entities/session.entity';

describe('SessionService', () => {
  it('invalidateAllSessions deletes refresh tokens and sessions', async () => {
    const refreshDelete = jest.fn();
    const sessionDelete = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: { delete: refreshDelete },
        },
        {
          provide: getRepositoryToken(Session),
          useValue: { delete: sessionDelete },
        },
      ],
    }).compile();

    const service = module.get(SessionService);
    await service.invalidateAllSessions('user-1');

    expect(refreshDelete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(sessionDelete).toHaveBeenCalledWith({ userId: 'user-1' });
  });
});
