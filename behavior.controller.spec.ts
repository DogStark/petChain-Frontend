import { Test, TestingModule } from '@nestjs/testing';
import { BehaviorController } from './behavior.controller';
import { BehaviorService } from './behavior.service';
import { HttpStatus, INestApplication, ValidationPipe, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'; // Adjust path as necessary
import { ExecutionContext } from '@nestjs/common';

describe('BehaviorController', () => {
  let app: INestApplication;
  let behaviorService: BehaviorService;

  // Mock Data
  const mockBehavior = {
    id: 'uuid-123',
    petId: 'pet-456',
    type: 'Aggression',
    severity: 3,
    metrics: { intensity: 'medium', duration: 30 },
  };

  // Flag to toggle mock guard behavior for security tests
  let canActivateGuard = true;

  const mockBehaviorService = {
    create: jest.fn().mockResolvedValue(mockBehavior),
    findAll: jest.fn().mockResolvedValue([mockBehavior]),
    findOne: jest.fn().mockResolvedValue(mockBehavior),
    update: jest.fn().mockResolvedValue({ ...mockBehavior, severity: 5 }),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BehaviorController],
      providers: [
        {
          provide: BehaviorService,
          useValue: mockBehaviorService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (!canActivateGuard) {
            throw new ForbiddenException('Forbidden resource');
          }
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    behaviorService = module.get<BehaviorService>(BehaviorService);
    canActivateGuard = true; // Reset guard for each test
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /behavior', () => {
    it('should return 200 OK and a list of behavior logs', async () => {
      return request(app.getHttpServer())
        .get('/behavior')
        .expect(HttpStatus.OK)
        .expect([mockBehavior]);
    });

    it('should pass query filtering parameters to the service', async () => {
      const filters = { petId: 'pet-456', type: 'Anxiety' };
      await request(app.getHttpServer())
        .get('/behavior')
        .query(filters)
        .expect(HttpStatus.OK);

      expect(behaviorService.findAll).toHaveBeenCalledWith(expect.objectContaining(filters));
    });
  });

  describe('POST /behavior', () => {
    const validDto = {
      petId: 'pet-456',
      type: 'Aggression',
      severity: 3,
      metrics: { intensity: 'medium', duration: 30 },
    };

    it('should return 201 Created for valid payloads', async () => {
      return request(app.getHttpServer())
        .post('/behavior')
        .send(validDto)
        .expect(HttpStatus.CREATED)
        .expect(mockBehavior);
    });

    it('should return 400 Bad Request if mandatory fields are missing (DTO Validation)', async () => {
      const invalidDto = { type: 'Aggression' }; // Missing petId
      return request(app.getHttpServer())
        .post('/behavior')
        .send(invalidDto)
        .expect(HttpStatus.BAD_REQUEST)
        .expect((res) => {
          expect(res.body.message).toBeDefined();
        });
    });
  });

  describe('PUT /behavior/:id', () => {
    const updateDto = { severity: 5 };

    it('should successfully update and return 200 OK', async () => {
      return request(app.getHttpServer())
        .put('/behavior/uuid-123')
        .send(updateDto)
        .expect(HttpStatus.OK)
        .expect({ ...mockBehavior, severity: 5 });
    });

    it('should return 404 if the record does not exist', async () => {
      jest.spyOn(behaviorService, 'update').mockRejectedValueOnce(new NotFoundException());

      return request(app.getHttpServer())
        .put('/behavior/non-existent')
        .send(updateDto)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /behavior/:id', () => {
    it('should successfully delete and return 200 OK', async () => {
      return request(app.getHttpServer())
        .delete('/behavior/uuid-123')
        .expect(HttpStatus.OK)
        .expect({ deleted: true });
    });

    it('should handle routing and parameter mapping correctly', async () => {
      await request(app.getHttpServer())
        .delete('/behavior/specific-id-123')
        .expect(HttpStatus.OK);

      expect(behaviorService.remove).toHaveBeenCalledWith('specific-id-123');
    });
  });

  describe('Security & Authorization Boundaries', () => {
    it('should return 403 Forbidden if the authorization guard fails', async () => {
      canActivateGuard = false; // Simulate guard rejection

      return request(app.getHttpServer())
        .get('/behavior')
        .expect(HttpStatus.FORBIDDEN);
    });

    // Note: In real scenarios, 401 is usually thrown by Passport before the guard
    // This mocks the outcome of an unauthorized request
    it('should prevent access to POST /behavior without valid credentials', async () => {
      canActivateGuard = false;

      return request(app.getHttpServer())
        .post('/behavior')
        .send({})
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('Error Mapping & Consistency', () => {
    it('should map internal NotFoundException to 404 response', async () => {
      jest.spyOn(behaviorService, 'findOne').mockRejectedValueOnce(new NotFoundException('Behavior not found'));

      const response = await request(app.getHttpServer()).get('/behavior/missing-id');

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Behavior not found');
    });

    it('should map unexpected service errors to 500 status', async () => {
      jest.spyOn(behaviorService, 'findAll').mockRejectedValueOnce(new Error('DB failure'));

      return request(app.getHttpServer())
        .get('/behavior')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
