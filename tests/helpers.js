'use strict';

/**
 * Test helper utilities
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

/**
 * Generate a test JWT token for a user
 */
const generateTestToken = (userId, roles = ['GRANTEE'], expiresIn = '1h') => {
  return jwt.sign(
    { userId, roles },
    JWT_SECRET,
    {
      expiresIn,
      issuer: 'grant-portal',
      audience: 'grant-portal-users',
    }
  );
};

/**
 * Generate an expired JWT token for testing
 */
const generateExpiredToken = (userId, roles = ['GRANTEE']) => {
  return jwt.sign(
    { userId, roles },
    JWT_SECRET,
    {
      expiresIn: '-1s',
      issuer: 'grant-portal',
      audience: 'grant-portal-users',
    }
  );
};

/**
 * Mock user data factory
 */
const createMockUser = (overrides = {}) => ({
  id: 'user-uuid-1234-5678-abcd',
  name: 'Test User',
  email: 'test@example.com',
  is_active: true,
  oauth_provider: null,
  oauth_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  roles: [{ name: 'GRANTEE', id: 'role-uuid-grantee' }],
  toJSON: function () { return { ...this }; },
  toPublicJSON: function () {
    const { password_hash, ...rest } = this;
    return rest;
  },
  verifyPassword: jest.fn().mockResolvedValue(true),
  update: jest.fn().mockResolvedValue(true),
  destroy: jest.fn().mockResolvedValue(true),
  ...overrides,
});

/**
 * Mock grant data factory
 */
const createMockGrant = (overrides = {}) => ({
  id: 'grant-uuid-1234',
  title: 'Test Research Grant',
  description: 'A grant for testing purposes',
  amount: 50000.00,
  deadline: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  status: 'open',
  grantor_id: 'grantor-uuid-1234',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  grantor: {
    id: 'grantor-uuid-1234',
    name: 'Test Grantor',
    email: 'grantor@example.com',
  },
  toJSON: function () { return { ...this }; },
  update: jest.fn().mockResolvedValue(true),
  destroy: jest.fn().mockResolvedValue(true),
  ...overrides,
});

/**
 * Mock application data factory
 */
const createMockApplication = (overrides = {}) => ({
  id: 'app-uuid-1234',
  grant_id: 'grant-uuid-1234',
  grantee_id: 'grantee-uuid-1234',
  proposal: 'This is my detailed proposal for the grant.',
  status: 'submitted',
  reviewer_notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  grant: {
    id: 'grant-uuid-1234',
    title: 'Test Grant',
    grantor_id: 'grantor-uuid-1234',
    grantor: { id: 'grantor-uuid-1234', name: 'Test Grantor', email: 'grantor@example.com' },
  },
  grantee: {
    id: 'grantee-uuid-1234',
    name: 'Test Grantee',
    email: 'grantee@example.com',
  },
  toJSON: function () { return { ...this }; },
  update: jest.fn().mockResolvedValue(true),
  ...overrides,
});

module.exports = {
  generateTestToken,
  generateExpiredToken,
  createMockUser,
  createMockGrant,
  createMockApplication,
};
