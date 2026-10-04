'use strict';

const { body } = require('express-validator');
const AuthService = require('../services/AuthService');
const { blacklistToken } = require('../utils/redis');
const { validateRequest } = require('../middleware/errorHandler');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * AuthController - Handles all authentication related HTTP requests
 */

/**
 * POST /api/auth/register
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const user = await AuthService.register({ name, email, password });
    return res.status(201).json({
      status: 'success',
      message: 'User registered successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Login with email and password
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    return res.status(200).json({
      status: 'success',
      message: 'Login successful.',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/github
 * Redirect to GitHub OAuth authorization URL
 */
const githubOAuth = (req, res, next) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return next(ApiError.internal('GitHub OAuth is not configured.'));
    }

    const callbackUrl = encodeURIComponent(
      process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback'
    );
    const scope = encodeURIComponent('user:email');
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}&scope=${scope}`;

    return res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/github/callback
 * Handle GitHub OAuth callback
 */
const githubCallback = async (req, res, next) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return next(ApiError.badRequest(`OAuth error: ${error}`));
    }

    if (!code) {
      return next(ApiError.badRequest('Authorization code is required.'));
    }

    const result = await AuthService.handleGithubCallback(code);

    return res.status(200).json({
      status: 'success',
      message: 'GitHub OAuth login successful.',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/google
 * Redirect to Google OAuth authorization URL
 */
const googleOAuth = (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return next(ApiError.internal('Google OAuth is not configured.'));
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
    });

    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
const googleCallback = async (req, res, next) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return next(ApiError.badRequest(`OAuth error: ${error}`));
    }

    if (!code) {
      return next(ApiError.badRequest('Authorization code is required.'));
    }

    const result = await AuthService.handleGoogleCallback(code);

    return res.status(200).json({
      status: 'success',
      message: 'Google OAuth login successful.',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Logout - blacklist the current token
 */
const logout = async (req, res, next) => {
  try {
    if (req.token) {
      // Blacklist for 1 hour (typical token TTL)
      await blacklistToken(req.token, 3600);
    }

    return res.status(200).json({
      status: 'success',
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await AuthService.getProfile(req.user.userId);
    return res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 1, max: 255 }),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  validateRequest,
];

const loginValidation = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validateRequest,
];

module.exports = {
  register,
  registerValidation,
  login,
  loginValidation,
  githubOAuth,
  githubCallback,
  googleOAuth,
  googleCallback,
  logout,
  getProfile,
};
