'use strict';

/**
 * Integration tests for Applications API endpoints
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

// Mock models
jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Role: { findOne: jest.fn() },
  UserRole: { create: jest.fn() },
  Grant: { findByPk: jest.fn() },
  Application: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
}));

const request = require('supertest');
const app = require('../../src/app');
const { Application } = require('../../src/models');
const { generateTestToken, createMockApplication } = require('../helpers');

describe('Applications API Endpoints', () => {
  const granteeId = 'c0000000-0000-4000-8000-000000000003';
  const grantorId = 'b0000000-0000-4000-8000-000000000002';
  const adminId = 'd0000000-0000-4000-8000-000000000004';
  const appId = 'e0000000-0000-4000-8000-000000000005';

  const granteeToken = generateTestToken(granteeId, ['GRANTEE']);
  const grantorToken = generateTestToken(grantorId, ['GRANTOR']);
  const adminToken = generateTestToken(adminId, ['ADMIN']);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // GET /api/applications/my
  // ============================================
  describe('GET /api/applications/my', () => {
    it('should return 401 without auth', async () => {
      await request(app).get('/api/applications/my').expect(401);
    });

    it('should return 403 for non-GRANTEE', async () => {
      await request(app)
        .get('/api/applications/my')
        .set('Authorization', `Bearer ${grantorToken}`)
        .expect(403);
    });

    it('should return grantee applications list', async () => {
      Application.findAll.mockResolvedValue([createMockApplication({ id: appId })]);

      const res = await request(app)
        .get('/api/applications/my')
        .set('Authorization', `Bearer ${granteeToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.count).toBe(1);
    });
  });

  // ============================================
  // GET /api/applications/:appId
  // ============================================
  describe('GET /api/applications/:appId', () => {
    it('should return 401 without auth', async () => {
      await request(app).get(`/api/applications/${appId}`).expect(401);
    });

    it('should return application if user is the grantee who submitted it', async () => {
      const mockApp = createMockApplication({ id: appId, grantee_id: granteeId });
      Application.findByPk.mockResolvedValue(mockApp);

      const res = await request(app)
        .get(`/api/applications/${appId}`)
        .set('Authorization', `Bearer ${granteeToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });

    it('should return application if user is the grantor of parent grant', async () => {
      const mockApp = createMockApplication({ id: appId, grantee_id: granteeId });
      mockApp.grant.grantor_id = grantorId;
      Application.findByPk.mockResolvedValue(mockApp);

      const res = await request(app)
        .get(`/api/applications/${appId}`)
        .set('Authorization', `Bearer ${grantorToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
    });

    it('should return application if user is ADMIN', async () => {
      const mockApp = createMockApplication({ id: appId, grantee_id: granteeId });
      Application.findByPk.mockResolvedValue(mockApp);

      const res = await request(app)
        .get(`/api/applications/${appId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('success');
    });
  });

  // ============================================
  // PATCH /api/applications/:appId/status
  // ============================================
  describe('PATCH /api/applications/:appId/status', () => {
    it('should return 401 without auth', async () => {
      await request(app)
        .patch(`/api/applications/${appId}/status`)
        .send({ status: 'approved' })
        .expect(401);
    });

    it('should return 403 for GRANTEE', async () => {
      await request(app)
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${granteeToken}`)
        .send({ status: 'approved' })
        .expect(403);
    });

    it('should return 400 for invalid status', async () => {
      const res = await request(app)
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${grantorToken}`)
        .send({ status: 'unknown_status' })
        .expect(400);

      expect(res.body.status).toBe('error');
    });

    it('should update status when called by the owning GRANTOR', async () => {
      const mockApp = createMockApplication({ id: appId });
      mockApp.grant.grantor_id = grantorId;
      Application.findByPk
        .mockResolvedValueOnce(mockApp)
        .mockResolvedValueOnce({ ...mockApp, status: 'approved' });

      const res = await request(app)
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${grantorToken}`)
        .send({ status: 'approved', reviewer_notes: 'Great application' })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(mockApp.update).toHaveBeenCalled();
    });
  });
});
