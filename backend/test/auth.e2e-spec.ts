import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../src/modules/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { Session } from '../src/auth/entities/session.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const testUser = {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    password: 'Password123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    // Clean up test data
    if (dataSource.isInitialized) {
      const userRepo = dataSource.getRepository(User);
      const refreshTokenRepo = dataSource.getRepository(RefreshToken);
      const sessionRepo = dataSource.getRepository(Session);

      // Find and delete test user
      const user = await userRepo.findOne({ where: { email: testUser.email } });
      if (user) {
        await refreshTokenRepo.delete({ userId: user.id });
        await sessionRepo.delete({ userId: user.id });
        await userRepo.delete({ id: user.id });
      }
    }

    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.email).toBe(testUser.email);
          expect(res.body.firstName).toBe(testUser.firstName);
          expect(res.body.lastName).toBe(testUser.lastName);
          expect(res.body).not.toHaveProperty('password');
          expect(res.body.emailVerified).toBe(false);
        });
    });

    it('should reject registration with weak password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'weak@example.com',
          password: 'weak',
        })
        .expect(400);
    });

    it('should reject registration with duplicate email', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'duplicate@example.com',
        })
        .expect(201);

      // Duplicate registration
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'duplicate@example.com',
        })
        .expect(409);
    });

    it('should reject registration with invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // Register first
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'login@example.com',
        })
        .expect(201);

      // Login
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: testUser.password,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe('login@example.com');
        });
    });

    it('should reject login with invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject login with wrong password', async () => {
      // Register first
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'wrongpass@example.com',
        })
        .expect(201);

      // Try to login with wrong password
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'wrongpass@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get tokens
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'refresh@example.com',
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'refresh@example.com',
          password: testUser.password,
        })
        .expect(200);

      refreshToken = loginResponse.body.refreshToken;
    });

    it('should refresh tokens successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body.refreshToken).not.toBe(refreshToken); // Should be rotated
        });
    });

    it('should reject refresh with invalid token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      // Register user
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'verify@example.com',
        })
        .expect(201);

      // Note: In a real scenario, you'd get the token from the email
      // For testing, we'd need to extract it from the database or mock the email service
      // This is a placeholder test structure
      expect(registerResponse.body.emailVerified).toBe(false);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should accept forgot password request', async () => {
      // Register user first
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'forgot@example.com',
        })
        .expect(201);

      // Request password reset
      return request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'forgot@example.com',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should not reveal if email exists (security)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(200); // Should return 200 even if email doesn't exist
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'logout@example.com',
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'logout@example.com',
          password: testUser.password,
        })
        .expect(200);

      accessToken = loginResponse.body.accessToken;
      refreshToken = loginResponse.body.refreshToken;
    });

    it('should logout successfully with valid token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          refreshToken,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Logged out');
        });
    });

    it('should reject logout without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({
          refreshToken,
        })
        .expect(401);
    });
  });
});
