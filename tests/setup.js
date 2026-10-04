'use strict';

/**
 * Jest test environment setup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'grantportal_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'Admin@123456';
process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';
process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/api/auth/github/callback';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/api/auth/google/callback';

// Mock ioredis globally so all redis calls succeed instantly without network
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    const store = new Map();
    return {
      store,
      on: jest.fn((event, handler) => {
        if (event === 'connect' || event === 'ready') {
          setTimeout(handler, 0);
        }
      }),
      get: jest.fn(async (key) => store.get(key) || null),
      set: jest.fn(async (key, val) => { store.set(key, val); return 'OK'; }),
      setex: jest.fn(async (key, ttl, val) => { store.set(key, val); return 'OK'; }),
      del: jest.fn(async (key) => (store.delete(key) ? 1 : 0)),
      quit: jest.fn(async () => 'OK'),
    };
  });
});
