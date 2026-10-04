'use strict';

const jwt = require('jsonwebtoken');
const logger = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate an access JWT token
 * @param {object} payload - { userId, roles }
 * @returns {string} JWT token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    {
      userId: payload.userId,
      roles: payload.roles,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'grant-portal',
      audience: 'grant-portal-users',
    }
  );
};

/**
 * Generate a refresh JWT token
 * @param {object} payload - { userId }
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    { userId: payload.userId },
    JWT_REFRESH_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'grant-portal',
      audience: 'grant-portal-users',
    }
  );
};

/**
 * Verify an access token
 * @param {string} token
 * @returns {object|null} decoded payload or null
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'grant-portal',
      audience: 'grant-portal-users',
    });
  } catch (error) {
    logger.debug('JWT verification failed:', error.message);
    return null;
  }
};

/**
 * Verify a refresh token
 * @param {string} token
 * @returns {object|null} decoded payload or null
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'grant-portal',
      audience: 'grant-portal-users',
    });
  } catch (error) {
    logger.debug('Refresh token verification failed:', error.message);
    return null;
  }
};

/**
 * Decode a token without verification (for debugging)
 * @param {string} token
 * @returns {object|null} decoded payload or null
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
