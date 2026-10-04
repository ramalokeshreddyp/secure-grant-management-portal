'use strict';

/**
 * Integration tests for User management API endpoints (Admin only)
 */

// Mock database connection
jest.mock('../../src/db/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true),
    define: jest.fn(),
  },
  connectDB: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/models', () => ({
  User: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  Role: { findOne: jest.fn(), findAll: jest.fn() },
  UserRole: { create: jest.fn(), findOne: jest.fn(), destroy: jest.fn() },
  Grant: {},
  Application: {},
}));

const request = require('supertest');
const app = require('../../src/app');
const { User, Role, UserRole } = require('../../src/models');
const { generateTestToken, createMockUser } = require('../helpers');

describe('Users API Endpoints', () => {
  const adminToken = generateTestToken('admin-id', ['ADMIN']);
  const grantorToken = generateTestToken('grantor-id', ['GRANTOR']);
  const granteeToken = generateTestToken('grantee-id', ['GRANTEE']);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // GET /api/users
  // ============================================
  describe('GET /api/users', () => {
    it('should return 401 without auth', async () => {
      await request(app).get('/api/users').expect(401);
    });

    it('should return 403 for GRANTOR', async () => {
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${grantorToken}`)
        .expect(403);
    });

    it('should return 403 for GRANTEE', async () => {
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${granteeToken}`)
        .expect(403);
    });

    it('should return list of users for ADMIN', async () => {
      const users = [createMockUser(), createMockUser({ id: 'user-2', email: 'user2@test.com' })];
      User.findAll.mockResolvedValue(users);

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveLength(2);
    });
  });

  // ============================================
  // POST /api/users/:userId/roles
  // ============================================
  describe('POST /api/users/:userId/roles', () => {
    it('should return 401 without auth', async () => {
      await request(app)
        .post('/api/users/user-id/roles')
        .send({ roleName: 'GRANTOR' })
        .expect(401);
    });

    it('should return 403 for non-ADMIN', async () => {
      await request(app)
        .post('/api/users/user-id/roles')
        .set('Authorization', `Bearer ${granteeToken}`)
        .send({ roleName: 'GRANTOR' })
        .expect(403);
    });

    it('should return 400 for invalid role name', async () => {
      const res = await request(app)
        .post('/api/users/550e8400-e29b-41d4-a716-446655440000/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleName: 'SUPERUSER' })
        .expect(400);

      expect(res.body.status).toBe('error');
    });

    it('should assign role successfully as ADMIN', async () => {
      const targetUser = createMockUser({ id: '550e8400-e29b-41d4-a716-446655440000' });
      User.findByPk
        .mockResolvedValueOnce(targetUser)  // for UserService.assignRole
        .mockResolvedValueOnce({ ...targetUser, roles: [{ id: 'role-id', name: 'GRANTOR' }] }); // for getUserById

      Role.findOne.mockResolvedValue({ id: 'role-id', name: 'GRANTOR' });
      UserRole.findOne = jest.fn().mockResolvedValue(null);
      UserRole.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/users/550e8400-e29b-41d4-a716-446655440000/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleName: 'GRANTOR' })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('GRANTOR');
    });

    it('should return 404 if user not found', async () => {
      User.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/users/550e8400-e29b-41d4-a716-446655440000/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleName: 'GRANTOR' })
        .expect(404);

      expect(res.body.status).toBe('error');
    });
  });

  // ============================================
  // GET /api/users/:userId
  // ============================================
  describe('GET /api/users/:userId', () => {
    it('should return 403 for non-ADMIN', async () => {
      await request(app)
        .get('/api/users/some-user-id')
        .set('Authorization', `Bearer ${granteeToken}`)
        .expect(403);
    });

    it('should return user for ADMIN', async () => {
      const mockUser = createMockUser();
      User.findByPk.mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/users/user-uuid-1234-5678-abcd')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
    });
  });
});
