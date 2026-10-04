'use strict';

const bcrypt = require('bcryptjs');
const axios = require('axios');
const { User, Role, UserRole } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const { setCache, getCache } = require('../utils/redis');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * AuthService - Business logic for authentication
 */
class AuthService {
  /**
   * Register a new user with email and password
   * @param {object} data - { name, email, password }
   * @returns {object} Created user (without password)
   */
  async register({ name, email, password }) {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw ApiError.conflict('A user with this email already exists.');
    }

    // Hash password
    const password_hash = await User.hashPassword(password);

    // Get default GRANTEE role
    const granteeRole = await Role.findOne({ where: { name: 'GRANTEE' } });
    if (!granteeRole) {
      throw ApiError.internal('Default role not configured. Please contact an administrator.');
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password_hash,
      is_active: true,
    });

    // Assign GRANTEE role by default
    await UserRole.create({
      user_id: user.id,
      role_id: granteeRole.id,
    });

    logger.info(`User registered: ${email}`);

    // Return user without password_hash
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
    };
  }

  /**
   * Login with email and password
   * @param {string} email
   * @param {string} password
   * @returns {object} { accessToken, refreshToken, user }
   */
  async login(email, password) {
    // Find user with password_hash scope
    const user = await User.scope('withPassword').findOne({
      where: { email, is_active: true },
      include: [{ model: Role, as: 'roles', attributes: ['name'] }],
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    // Verify password
    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    const roles = user.roles.map((r) => r.name);

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user.id, roles });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // Cache refresh token
    await setCache(`refresh:${user.id}`, refreshToken, 7 * 24 * 3600);

    logger.info(`User logged in: ${email}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles,
      },
    };
  }

  /**
   * Handle OAuth 2.0 GitHub callback
   * @param {string} code - Authorization code
   * @returns {object} { accessToken, refreshToken, user }
   */
  async handleGithubCallback(code) {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );

    const { access_token, error } = tokenResponse.data;
    if (error || !access_token) {
      throw ApiError.badRequest('Failed to exchange authorization code for access token.');
    }

    // Fetch user profile from GitHub
    const profileResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profile = profileResponse.data;

    // Fetch primary email if not public
    let email = profile.email;
    if (!email) {
      const emailResponse = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const primaryEmail = emailResponse.data.find((e) => e.primary && e.verified);
      email = primaryEmail ? primaryEmail.email : null;
    }

    if (!email) {
      throw ApiError.badRequest('Could not retrieve a verified email address from GitHub.');
    }

    return this._findOrCreateOAuthUser({
      email,
      name: profile.name || profile.login,
      oauth_provider: 'github',
      oauth_id: String(profile.id),
      avatar_url: profile.avatar_url,
    });
  }

  /**
   * Handle OAuth 2.0 Google callback
   * @param {string} code - Authorization code
   * @returns {object} { accessToken, refreshToken, user }
   */
  async handleGoogleCallback(code) {
    // Exchange code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenResponse.data;
    if (!access_token) {
      throw ApiError.badRequest('Failed to obtain access token from Google.');
    }

    // Fetch user profile
    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profile = profileResponse.data;

    return this._findOrCreateOAuthUser({
      email: profile.email,
      name: profile.name,
      oauth_provider: 'google',
      oauth_id: String(profile.id),
      avatar_url: profile.picture,
    });
  }

  /**
   * Find existing user or create new OAuth user
   * @param {object} profileData
   * @returns {object} { accessToken, refreshToken, user }
   */
  async _findOrCreateOAuthUser({ email, name, oauth_provider, oauth_id, avatar_url }) {
    // Check if user exists by email
    let user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: 'roles', attributes: ['name'] }],
    });

    if (user) {
      // Update OAuth info if not set
      if (!user.oauth_provider) {
        await user.update({ oauth_provider, oauth_id, avatar_url });
      }
    } else {
      // Create new user with GRANTEE role
      const granteeRole = await Role.findOne({ where: { name: 'GRANTEE' } });
      if (!granteeRole) {
        throw ApiError.internal('Default role not configured.');
      }

      user = await User.create({
        name,
        email,
        oauth_provider,
        oauth_id,
        avatar_url,
        is_active: true,
      });

      await UserRole.create({ user_id: user.id, role_id: granteeRole.id });

      // Reload with roles
      user = await User.findByPk(user.id, {
        include: [{ model: Role, as: 'roles', attributes: ['name'] }],
      });

      logger.info(`OAuth user created: ${email} via ${oauth_provider}`);
    }

    const roles = (user.roles || []).map((r) => r.name);
    const accessToken = generateAccessToken({ userId: user.id, roles });
    const refreshToken = generateRefreshToken({ userId: user.id });

    await setCache(`refresh:${user.id}`, refreshToken, 7 * 24 * 3600);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles,
      },
    };
  }

  /**
   * Get the current user's profile
   * @param {string} userId
   * @returns {object} User with roles
   */
  async getProfile(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: 'roles', attributes: ['name', 'id'] }],
    });

    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    return user;
  }
}

module.exports = new AuthService();
