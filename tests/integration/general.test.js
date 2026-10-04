'use strict';

/**
 * Integration tests for health check and general API routes
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
  Grant: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Application: { findAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() },
}));

const request = require('supertest');
const app = require('../../src/app');

describe('General API Endpoints', () => {
  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('grant-portal-api');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api', () => {
    it('should return API info', async () => {
      const res = await request(app).get('/api').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.endpoints).toBeDefined();
    });
  });

  describe('GET /non-existent-route', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/non-existent-route').expect(404);
      expect(res.body.status).toBe('error');
    });
  });

  describe('Security headers', () => {
    it('should include security headers (Helmet)', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBeDefined();
    });
  });
});
