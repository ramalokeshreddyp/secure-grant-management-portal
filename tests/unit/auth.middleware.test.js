'use strict';

/**
 * Unit tests for RBAC authentication middleware
 */

const { generateTestToken, generateExpiredToken } = require('../helpers');

// Mock models
jest.mock('../../src/models', () => ({
  User: {
    findByPk: jest.fn(),
  },
  Role: {},
  UserRole: {},
  Grant: {},
  Application: {},
}));

jest.mock('../../src/utils/redis', () => ({
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
  blacklistToken: jest.fn().mockResolvedValue(true),
  setCache: jest.fn().mockResolvedValue(true),
  getCache: jest.fn().mockResolvedValue(null),
}));

const { authenticate, authorize } = require('../../src/middleware/auth');
const redis = require('../../src/utils/redis');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null,
      token: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();

    redis.isTokenBlacklisted.mockResolvedValue(false);
  });

  describe('authenticate', () => {
    it('should return 401 if no Authorization header', async () => {
      await authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should return 401 if Authorization header is not Bearer', async () => {
      req.headers.authorization = 'Basic sometoken';
      await authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should return 401 if token is missing after Bearer', async () => {
      req.headers.authorization = 'Bearer ';
      await authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should return 401 if token is blacklisted', async () => {
      const redis = require('../../src/utils/redis');
      redis.isTokenBlacklisted.mockResolvedValue(true);
      const token = generateTestToken('user-id-123', ['GRANTEE']);
      req.headers.authorization = `Bearer ${token}`;

      await authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should return 401 if token is invalid', async () => {
      req.headers.authorization = 'Bearer invalid.token.here';
      await authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should return 401 if token is expired', async () => {
      const expiredToken = generateExpiredToken('user-id-123', ['GRANTEE']);
      req.headers.authorization = `Bearer ${expiredToken}`;
      await authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should call next() and attach user to req if token is valid', async () => {
      const userId = 'user-id-123';
      const roles = ['GRANTEE'];
      const token = generateTestToken(userId, roles);
      req.headers.authorization = `Bearer ${token}`;

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(); // no error
      expect(req.user).toEqual({ userId, roles });
      expect(req.token).toBe(token);
    });

    it('should handle uppercase Authorization header', async () => {
      const token = generateTestToken('user-id-123', ['ADMIN']);
      req.headers['authorization'] = `Bearer ${token}`;
      await authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user.roles).toContain('ADMIN');
    });
  });

  describe('authorize', () => {
    beforeEach(() => {
      req.user = { userId: 'user-id-123', roles: ['GRANTEE'] };
    });

    it('should call next() if user has required role', () => {
      const middleware = authorize('GRANTEE');
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should return 403 if user does not have required role', () => {
      const middleware = authorize('GRANTOR');
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('should return 403 if user has GRANTEE but needs ADMIN', () => {
      req.user.roles = ['GRANTEE'];
      const middleware = authorize('ADMIN');
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('should allow access if user has any of multiple required roles', () => {
      req.user.roles = ['GRANTOR'];
      const middleware = authorize('ADMIN', 'GRANTOR');
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should return 401 if req.user is not set', () => {
      req.user = null;
      const middleware = authorize('GRANTEE');
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it('should allow ADMIN when multiple roles are accepted', () => {
      req.user.roles = ['ADMIN'];
      const middleware = authorize('GRANTEE', 'GRANTOR', 'ADMIN');
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });
  });
});
