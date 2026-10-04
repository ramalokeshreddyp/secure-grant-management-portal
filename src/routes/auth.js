'use strict';

const router = require('express').Router();
const AuthController = require('../controllers/AuthController');
const { authenticate } = require('../middleware/auth');

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post(
  '/register',
  AuthController.registerValidation,
  AuthController.register
);

/**
 * @route POST /api/auth/login
 * @desc Login with email/password
 * @access Public
 */
router.post(
  '/login',
  AuthController.loginValidation,
  AuthController.login
);

/**
 * @route GET /api/auth/github
 * @desc Redirect to GitHub OAuth
 * @access Public
 */
router.get('/github', AuthController.githubOAuth);

/**
 * @route GET /api/auth/github/callback
 * @desc GitHub OAuth callback
 * @access Public
 */
router.get('/github/callback', AuthController.githubCallback);

/**
 * @route GET /api/auth/google
 * @desc Redirect to Google OAuth
 * @access Public
 */
router.get('/google', AuthController.googleOAuth);

/**
 * @route GET /api/auth/google/callback
 * @desc Google OAuth callback
 * @access Public
 */
router.get('/google/callback', AuthController.googleCallback);

/**
 * @route POST /api/auth/logout
 * @desc Logout (blacklist current token)
 * @access Private
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticate, AuthController.getProfile);

module.exports = router;
