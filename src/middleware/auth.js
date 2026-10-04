'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { isTokenBlacklisted } = require('../utils/redis');
const ApiError = require('../utils/ApiError');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Authentication middleware - verifies JWT and attaches user to request
 * Returns 401 if token is missing or invalid
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('Authentication required. Please provide a valid Bearer token.'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(ApiError.unauthorized('Token is missing.'));
    }

    // Check if token is blacklisted (logged out)
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return next(ApiError.unauthorized('Token has been revoked. Please log in again.'));
    }

    // Verify token
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return next(ApiError.unauthorized('Invalid or expired token. Please log in again.'));
    }

    // Attach decoded payload to request
    req.user = {
      userId: decoded.userId,
      roles: decoded.roles || [],
    };
    req.token = token;

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return next(ApiError.unauthorized('Authentication failed.'));
  }
};

/**
 * Authorization middleware factory - checks if user has required roles
 * Returns 403 if user lacks the required role(s)
 * @param {...string} requiredRoles - Role names required to access the endpoint
 */
const authorize = (...requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required.'));
    }

    const userRoles = req.user.roles || [];
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      logger.warn(`Access denied: User ${req.user.userId} with roles [${userRoles.join(', ')}] tried to access endpoint requiring [${requiredRoles.join(', ')}]`);
      return next(ApiError.forbidden(`Access denied. Required roles: ${requiredRoles.join(' or ')}.`));
    }

    next();
  };
};

module.exports = { authenticate, authorize };
