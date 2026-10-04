'use strict';

/**
 * Unit tests for JWT utility functions
 */

const { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken, decodeToken } = require('../../src/utils/jwt');

describe('JWT Utility', () => {
  const mockPayload = {
    userId: 'test-user-id-123',
    roles: ['GRANTEE', 'ADMIN'],
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateAccessToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include userId and roles in payload', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = decodeToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.roles).toEqual(mockPayload.roles);
    });

    it('should include iat and exp claims', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = decodeToken(token);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should include issuer claim', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = decodeToken(token);
      expect(decoded.iss).toBe('grant-portal');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken({ userId: mockPayload.userId });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should include userId in payload', () => {
      const token = generateRefreshToken({ userId: mockPayload.userId });
      const decoded = decodeToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token and return decoded payload', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = verifyAccessToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.roles).toEqual(mockPayload.roles);
    });

    it('should return null for an invalid token', () => {
      const result = verifyAccessToken('invalid.token.here');
      expect(result).toBeNull();
    });

    it('should return null for an empty string', () => {
      const result = verifyAccessToken('');
      expect(result).toBeNull();
    });

    it('should return null for a tampered token', () => {
      const token = generateAccessToken(mockPayload);
      const tampered = token.slice(0, -5) + 'xxxxx';
      const result = verifyAccessToken(tampered);
      expect(result).toBeNull();
    });

    it('should return null for a token signed with wrong secret', () => {
      const jwt = require('jsonwebtoken');
      const wrongToken = jwt.sign(mockPayload, 'wrong-secret', { expiresIn: '1h' });
      const result = verifyAccessToken(wrongToken);
      expect(result).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken({ userId: mockPayload.userId });
      const decoded = verifyRefreshToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded.userId).toBe(mockPayload.userId);
    });

    it('should return null for an access token used as refresh token', () => {
      const accessToken = generateAccessToken(mockPayload);
      const result = verifyRefreshToken(accessToken);
      expect(result).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('should decode a token without verification', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = decodeToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
    });

    it('should return null for invalid token', () => {
      const result = decodeToken('not-a-jwt');
      expect(result).toBeNull();
    });
  });
});
