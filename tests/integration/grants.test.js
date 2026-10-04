'use strict';

/**
 * Integration tests for Grants API endpoints (RBAC enforcement)
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
  User: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Role: { findOne: jest.fn() },
  UserRole: { create: jest.fn() },
  Grant: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Application: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), findByPk: jest.fn() },
}));

const request = require('supertest');
const app = require('../../src/app');
const { Grant, Application } = require('../../src/models');
const { generateTestToken, createMockGrant, createMockApplication } = require('../helpers');

describe('Grants API Endpoints', () => {
  const grantorId = 'b0000000-0000-4000-8000-000000000002';
  const granteeId = 'c0000000-0000-4000-8000-000000000003';
  const adminId = 'd0000000-0000-4000-8000-000000000004';
  const grantId = 'a0000000-0000-4000-8000-000000000001';

  const grantorToken = generateTestToken(grantorId, ['GRANTOR']);
  const granteeToken = generateTestToken(granteeId, ['GRANTEE']);
  const adminToken = generateTestToken(adminId, ['ADMIN']);
  const granteeWithGrantorToken = generateTestToken(grantorId, ['GRANTEE']);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // POST /api/grants
  // ============================================
  describe('POST /api/grants', () => {
    const validGrant = {
      title: 'Research Grant for AI',
      description: 'Funding for AI research projects',
      amount: 50000,
    };

    it('should return 401 if no token provided', async () => {
      const res = await request(app)
        .post('/api/grants')
        .send(validGrant)
        .expect(401);
      expect(res.body.status).toBe('error');
    });

    it('should return 403 if user is GRANTEE (not GRANTOR)', async () => {
      const res = await request(app)
        .post('/api/grants')
        .set('Authorization', `Bearer ${granteeToken}`)
        .send(validGrant)
        .expect(403);
      expect(res.body.status).toBe('error');
    });

    it('should return 403 if user is ADMIN (not GRANTOR)', async () => {
      const res = await request(app)
        .post('/api/grants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validGrant)
        .expect(403);
      expect(res.body.status).toBe('error');
    });

    it('should create a grant if user is GRANTOR', async () => {
      const mockGrant = createMockGrant({ grantor_id: grantorId });
      Grant.create.mockResolvedValue(mockGrant);
      Grant.findByPk.mockResolvedValue(mockGrant);

      const res = await request(app)
        .post('/api/grants')
        .set('Authorization', `Bearer ${grantorToken}`)
        .send(validGrant)
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 for missing title', async () => {
      const res = await request(app)
        .post('/api/grants')
        .set('Authorization', `Bearer ${grantorToken}`)
        .send({ description: 'No title', amount: 1000 })
        .expect(400);
      expect(res.body.status).toBe('error');
    });

    it('should return 400 for invalid amount', async () => {
      const res = await request(app)
        .post('/api/grants')
        .set('Authorization', `Bearer ${grantorToken}`)
        .send({ ...validGrant, amount: -100 })
        .expect(400);
      expect(res.body.status).toBe('error');
    });
  });

  // ============================================
  // GET /api/grants
  // ============================================
  describe('GET /api/grants', () => {
    it('should return 401 if not authenticated', async () => {
      await request(app).get('/api/grants').expect(401);
    });

    it('should return grants for GRANTEE', async () => {
      Grant.findAll.mockResolvedValue([createMockGrant(), createMockGrant({ id: 'grant-2' })]);

      const res = await request(app)
        .get('/api/grants')
        .set('Authorization', `Bearer ${granteeToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should return grants for GRANTOR', async () => {
      Grant.findAll.mockResolvedValue([createMockGrant()]);

      const res = await request(app)
        .get('/api/grants')
        .set('Authorization', `Bearer ${grantorToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
    });

    it('should return grants for ADMIN', async () => {
      Grant.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/grants')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
    });
  });

  // ============================================
  // GET /api/grants/:grantId
  // ============================================
  describe('GET /api/grants/:grantId', () => {
    it('should return 401 without auth', async () => {
      await request(app).get('/api/grants/grant-id').expect(401);
    });

    it('should return grant for authenticated user', async () => {
      const mockGrant = createMockGrant();
      Grant.findByPk.mockResolvedValue(mockGrant);

      const res = await request(app)
        .get('/api/grants/a0000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${granteeToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });

    it('should return 404 if grant not found', async () => {
      Grant.findByPk.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/grants/non-existent-uuid')
        .set('Authorization', `Bearer ${granteeToken}`)
        .expect(404);

      expect(res.body.status).toBe('error');
    });
  });

  // ============================================
  // PUT /api/grants/:grantId
  // ============================================
  describe('PUT /api/grants/:grantId', () => {
    it('should return 401 without auth', async () => {
      await request(app).put('/api/grants/grant-id').send({ title: 'Updated' }).expect(401);
    });

    it('should return 403 if GRANTEE tries to update', async () => {
      const res = await request(app)
        .put('/api/grants/a0000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${granteeToken}`)
        .send({ title: 'Updated' })
        .expect(403);
      expect(res.body.status).toBe('error');
    });

    it('should return 403 if GRANTOR tries to update another GRANTOR\'s grant', async () => {
      const otherGrant = createMockGrant({ grantor_id: 'other-grantor' });
      Grant.findByPk.mockResolvedValue(otherGrant);

      const res = await request(app)
        .put('/api/grants/a0000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${grantorToken}`)
        .send({ title: 'Updated' })
        .expect(403);
      expect(res.body.status).toBe('error');
    });

    it('should update grant if GRANTOR is the owner', async () => {
      const ownGrant = createMockGrant({ grantor_id: grantorId });
      ownGrant.update = jest.fn().mockResolvedValue(true);
      Grant.findByPk
        .mockResolvedValueOnce(ownGrant)
        .mockResolvedValueOnce({ ...ownGrant, title: 'Updated Title' });

      const res = await request(app)
        .put('/api/grants/a0000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${grantorToken}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(res.body.status).toBe('success');
    });
  });

  // ============================================
  // DELETE /api/grants/:grantId
  // ============================================
  describe('DELETE /api/grants/:grantId', () => {
    it('should return 401 without auth', async () => {
      await request(app).delete('/api/grants/grant-id').expect(401);
    });

    it('should return 403 if GRANTEE tries to delete', async () => {
      const res = await request(app)
        .delete('/api/grants/a0000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${granteeToken}`)
        .expect(403);
      expect(res.body.status).toBe('error');
    });

    it('should allow ADMIN to delete any grant', async () => {
      const mockGrant = createMockGrant({ grantor_id: 'someone-else' });
      Grant.findByPk.mockResolvedValue(mockGrant);

      const res = await request(app)
        .delete('/api/grants/a0000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(mockGrant.destroy).toHaveBeenCalled();
    });

    it('should allow GRANTOR to delete own grant', async () => {
      const ownGrant = createMockGrant({ grantor_id: grantorId });
      Grant.findByPk.mockResolvedValue(ownGrant);

      const res = await request(app)
        .delete('/api/grants/a0000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${grantorToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
    });
  });

  // ============================================
  // POST /api/grants/:grantId/apply
  // ============================================
  describe('POST /api/grants/:grantId/apply', () => {
    it('should return 403 if GRANTOR tries to apply', async () => {
      const res = await request(app)
        .post('/api/grants/a0000000-0000-4000-8000-000000000001/apply')
        .set('Authorization', `Bearer ${grantorToken}`)
        .send({ proposal: 'My proposal text' })
        .expect(403);
      expect(res.body.status).toBe('error');
    });

    it('should allow GRANTEE to apply for a grant', async () => {
      const mockGrant = createMockGrant({ status: 'open' });
      Grant.findByPk.mockResolvedValue(mockGrant);
      Application.findOne.mockResolvedValue(null);
      const newApp = createMockApplication({ grantee_id: granteeId });
      Application.create.mockResolvedValue(newApp);
      Application.findByPk.mockResolvedValue(newApp);

      const res = await request(app)
        .post('/api/grants/a0000000-0000-4000-8000-000000000001/apply')
        .set('Authorization', `Bearer ${granteeToken}`)
        .send({ proposal: 'My detailed proposal for this grant' })
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 for missing proposal', async () => {
      const res = await request(app)
        .post('/api/grants/a0000000-0000-4000-8000-000000000001/apply')
        .set('Authorization', `Bearer ${granteeToken}`)
        .send({})
        .expect(400);
      expect(res.body.status).toBe('error');
    });
  });

  // ============================================
  // GET /api/grants/:grantId/applications
  // ============================================
  describe('GET /api/grants/:grantId/applications', () => {
    it('should return 403 if GRANTEE tries to view applications', async () => {
      const res = await request(app)
        .get('/api/grants/a0000000-0000-4000-8000-000000000001/applications')
        .set('Authorization', `Bearer ${granteeToken}`)
        .expect(403);
    });

    it('should return 403 if GRANTOR tries to view applications for another GRANTOR\'s grant', async () => {
      const otherGrant = createMockGrant({ grantor_id: 'other-grantor' });
      Grant.findByPk.mockResolvedValue(otherGrant);

      const res = await request(app)
        .get('/api/grants/a0000000-0000-4000-8000-000000000001/applications')
        .set('Authorization', `Bearer ${grantorToken}`)
        .expect(403);
    });

    it('should return applications for the grant owner GRANTOR', async () => {
      const ownGrant = createMockGrant({ grantor_id: grantorId });
      Grant.findByPk.mockResolvedValue(ownGrant);
      const apps = [createMockApplication()];
      Application.findAll.mockResolvedValue(apps);

      const res = await request(app)
        .get('/api/grants/a0000000-0000-4000-8000-000000000001/applications')
        .set('Authorization', `Bearer ${grantorToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveLength(1);
    });
  });
});
