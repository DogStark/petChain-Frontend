import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FilePermissionService } from '../files/services/file-permission.service';
import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let filePermissionService: FilePermissionService;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(() => {
    filePermissionService = {
      canAccessFile: jest.fn(),
    } as unknown as FilePermissionService;

    jwtService = {
      verify: jest.fn(),
    } as unknown as JwtService;

    configService = {
      get: jest.fn(),
    } as unknown as ConfigService;

    gateway = new RealtimeGateway(filePermissionService, jwtService, configService);
  });

  describe('handleConnection', () => {
    it('should populate client.data.userId from a valid JWT and join the user room', () => {
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: 'user-123' });
      (configService.get as jest.Mock).mockReturnValue('test-secret');

      const client: any = {
        id: 'socket-1',
        handshake: {
          auth: { token: 'valid-token' },
          headers: {},
        },
        join: jest.fn(),
        data: {},
      };

      gateway.handleConnection(client);

      expect(client.data.userId).toBe('user-123');
      expect(client.join).toHaveBeenCalledWith('user:user-123');
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'test-secret',
      });
    });

    it('should reject unauthenticated connections', () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      (configService.get as jest.Mock).mockReturnValue('test-secret');

      const client: any = {
        id: 'socket-1',
        handshake: {
          auth: { token: 'invalid-token' },
          headers: {},
        },
        join: jest.fn(),
        data: {},
      };

      expect(() => gateway.handleConnection(client)).toThrow(WsException);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscribeFile', () => {
    it('should allow subscribing to a file when the user has access', async () => {
      (filePermissionService.canAccessFile as jest.Mock).mockResolvedValue(true);

      const client: any = {
        id: 'socket-1',
        data: { userId: 'user-123' },
        join: jest.fn(),
      };

      const result = await gateway.handleSubscribeFile(client, 'file-abc');

      expect(filePermissionService.canAccessFile).toHaveBeenCalledWith(
        'file-abc',
        'user-123',
      );
      expect(client.join).toHaveBeenCalledWith('file:file-abc');
      expect(result).toEqual({ event: 'subscribed', data: 'file-abc' });
    });

    it('should reject subscribing to a file when the user does not have access', async () => {
      (filePermissionService.canAccessFile as jest.Mock).mockResolvedValue(false);

      const client: any = {
        id: 'socket-1',
        data: { userId: 'user-123' },
        join: jest.fn(),
      };

      await expect(gateway.handleSubscribeFile(client, 'file-abc')).rejects.toThrow(WsException);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscribeUser', () => {
    it('should allow subscribing to the authenticated user room', () => {
      const client: any = {
        id: 'socket-1',
        data: { userId: 'user-123' },
        join: jest.fn(),
      };

      const result = gateway.handleSubscribeUser(client, 'user-123');

      expect(client.join).toHaveBeenCalledWith('user:user-123');
      expect(result).toEqual({ event: 'subscribed', data: 'user-123' });
    });

    it('should reject subscribing to another user room', () => {
      const client: any = {
        id: 'socket-1',
        data: { userId: 'user-123' },
        join: jest.fn(),
      };

      expect(() => gateway.handleSubscribeUser(client, 'user-456')).toThrow(WsException);
      expect(client.join).not.toHaveBeenCalled();
    });
  });
});
