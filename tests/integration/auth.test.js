'use strict';

/**
 * Integration tests for Authentication API endpoints
 */

// Mock database connection
jest.mock('../../src/db/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true),
    define: jest.fn(),
    query: jest.fn(),
  },
  connectDB: jest.fn().mockResolvedValue(true),
}));

// Mock models
jest.mock('../../src/models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    hashPassword: jest.fn().mockResolvedValue('$hashed$password'),
    scope: jest.fn().mockReturnThis(),
  },
  Role: {
    findOne: jest.fn(),
  },
  UserRole: {
    create: jest.fn(),
    findOrCreate: jest.fn(),
  },
  Grant: {},
  Application: {},
}));

const request = require('supertest');
const app = require('../../src/app');
const { User, Role, UserRole } = require('../../src/models');
const { createMockUser, generateTestToken } = require('../helpers');

describe('Auth API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validPayload = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password123',
    };

    it('should register a new user and return 201', async () => {
      User.findOne.mockResolvedValue(null);
      User.hashPassword.mockResolvedValue('$hashed$');
      Role.findOne.mockResolvedValue({ id: 'role-id', name: 'GRANTEE' });
      const newUser = createMockUser({ id: 'new-id', name: 'John Doe', email: 'john@example.com' });
      User.create.mockResolvedValue(newUser);
      UserRole.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/auth/register')
        .send(validPayload)
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('email', validPayload.email);
      expect(res.body.data).not.toHaveProperty('password_hash');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com' })
        .expect(400);

      expect(res.body.status).toBe('error');
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validPayload, email: 'not-an-email' })
        .expect(400);

      expect(res.body.status).toBe('error');
    });

    it('should return 400 for weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validPayload, password: 'weak' })
        .expect(400);

      expect(res.body.status).toBe('error');
    });

    it('should return 409 if user already exists', async () => {
      User.findOne.mockResolvedValue(createMockUser());

      const res = await request(app)
        .post('/api/auth/register')
        .send(validPayload)
        .expect(409);

      expect(res.body.status).toBe('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 200 and accessToken on valid credentials', async () => {
      const mockUser = createMockUser({
        roles: [{ name: 'GRANTEE' }],
        verifyPassword: jest.fn().mockResolvedValue(true),
      });
      User.unscoped = jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(mockUser) });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password123' })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('should return 401 for invalid credentials', async () => {
      User.unscoped = jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@example.com', password: 'wrongpassword' })
        .expect(401);

      expect(res.body.status).toBe('error');
    });

    it('should return 400 for missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(res.body.status).toBe('error');
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-email', password: 'Password123' })
        .expect(400);

      expect(res.body.status).toBe('error');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 if no token provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.status).toBe('error');
    });

    it('should return current user profile with valid token', async () => {
      const mockUser = createMockUser();
      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      const token = generateTestToken('user-uuid-1234-5678-abcd', ['GRANTEE']);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 401 without token', async () => {
      await request(app)
        .post('/api/auth/logout')
        .expect(401);
    });

    it('should logout successfully with valid token', async () => {
      const token = generateTestToken('user-id', ['GRANTEE']);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe('success');
    });
  });

  describe('GET /api/auth/github', () => {
    it('should redirect to GitHub if CLIENT_ID is set', async () => {
      const res = await request(app)
        .get('/api/auth/github')
        .expect(302);

      expect(res.headers.location).toContain('github.com/login/oauth/authorize');
    });
  });

  describe('GET /api/auth/google', () => {
    it('should redirect to Google if CLIENT_ID is set', async () => {
      const res = await request(app)
        .get('/api/auth/google')
        .expect(302);

      expect(res.headers.location).toContain('accounts.google.com');
    });
  });
});
