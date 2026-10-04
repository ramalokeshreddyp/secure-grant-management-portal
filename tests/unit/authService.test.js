'use strict';

/**
 * Unit tests for AuthService
 */

const { createMockUser } = require('../helpers');

// Mock models
jest.mock('../../src/models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    hashPassword: jest.fn().mockResolvedValue('$hashed$password'),
    scope: jest.fn().mockReturnThis(),
    unscoped: jest.fn().mockReturnThis(),
  },
  Role: {
    findOne: jest.fn(),
  },
  UserRole: {
    create: jest.fn(),
    findOrCreate: jest.fn(),
  },
  Grant: {},
  Application: {},
}));

// Mock axios for OAuth tests
jest.mock('axios');
const axios = require('axios');

const AuthService = require('../../src/services/AuthService');
const { User, Role, UserRole } = require('../../src/models');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123',
    };

    it('should throw 409 if user already exists', async () => {
      User.findOne.mockResolvedValue(createMockUser());

      await expect(AuthService.register(validData)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('should throw 500 if GRANTEE role not found', async () => {
      User.findOne.mockResolvedValue(null);
      User.hashPassword.mockResolvedValue('hashed');
      Role.findOne.mockResolvedValue(null);

      await expect(AuthService.register(validData)).rejects.toMatchObject({
        statusCode: 500,
      });
    });

    it('should register a new user and assign GRANTEE role', async () => {
      User.findOne.mockResolvedValue(null);
      User.hashPassword.mockResolvedValue('hashed_password');

      const mockRole = { id: 'role-id', name: 'GRANTEE' };
      Role.findOne.mockResolvedValue(mockRole);

      const newUser = createMockUser({ id: 'new-user-id' });
      User.create.mockResolvedValue(newUser);
      UserRole.create.mockResolvedValue({});

      const result = await AuthService.register(validData);

      expect(User.findOne).toHaveBeenCalledWith({ where: { email: validData.email } });
      expect(User.create).toHaveBeenCalled();
      expect(UserRole.create).toHaveBeenCalledWith({
        user_id: newUser.id,
        role_id: mockRole.id,
      });
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email', validData.email);
      expect(result).not.toHaveProperty('password_hash');
    });
  });

  describe('login', () => {
    it('should throw 401 if user not found', async () => {
      User.unscoped = jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      });

      await expect(AuthService.login('wrong@example.com', 'password')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should throw 401 if password is incorrect', async () => {
      const mockUser = createMockUser({
        roles: [{ name: 'GRANTEE' }],
        verifyPassword: jest.fn().mockResolvedValue(false),
      });

      User.unscoped = jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(AuthService.login('test@example.com', 'wrongpassword')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should return accessToken on successful login', async () => {
      const mockUser = createMockUser({
        roles: [{ name: 'GRANTEE' }],
        verifyPassword: jest.fn().mockResolvedValue(true),
      });

      User.unscoped = jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await AuthService.login('test@example.com', 'Password123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.roles).toContain('GRANTEE');
    });
  });

  describe('getProfile', () => {
    it('should throw 404 if user not found', async () => {
      User.findByPk = jest.fn().mockResolvedValue(null);

      await expect(AuthService.getProfile('non-existent-id')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should return user with roles', async () => {
      const mockUser = createMockUser();
      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      const result = await AuthService.getProfile('user-id');
      expect(result).toEqual(mockUser);
    });
  });

  describe('handleGithubCallback', () => {
    it('should throw 400 if exchange code fails', async () => {
      axios.post.mockResolvedValue({ data: { error: 'bad_verification_code' } });

      await expect(AuthService.handleGithubCallback('invalid-code')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should create user on first GitHub login', async () => {
      axios.post.mockResolvedValue({ data: { access_token: 'gh-access-token' } });
      axios.get
        .mockResolvedValueOnce({
          data: { id: 12345, login: 'testuser', name: 'Test User', email: 'gh@example.com', avatar_url: 'http://avatar.url' },
        });

      User.findOne.mockResolvedValue(null);
      Role.findOne.mockResolvedValue({ id: 'role-id', name: 'GRANTEE' });

      const newUser = createMockUser({ id: 'new-user-id', email: 'gh@example.com' });
      User.create.mockResolvedValue(newUser);
      UserRole.create.mockResolvedValue({});
      User.findByPk = jest.fn().mockResolvedValue({
        ...newUser,
        roles: [{ name: 'GRANTEE' }],
      });

      const result = await AuthService.handleGithubCallback('valid-code');
      expect(result).toHaveProperty('accessToken');
      expect(result.user).toHaveProperty('email', 'gh@example.com');
    });

    it('should use email from /user/emails if profile email is null', async () => {
      axios.post.mockResolvedValue({ data: { access_token: 'gh-access-token' } });
      axios.get
        .mockResolvedValueOnce({ data: { id: 999, login: 'noEmailUser', name: 'No Email', email: null } })
        .mockResolvedValueOnce({ data: [{ email: 'primary@example.com', primary: true, verified: true }] });

      User.findOne.mockResolvedValue(null);
      Role.findOne.mockResolvedValue({ id: 'role-id', name: 'GRANTEE' });
      const newUser = createMockUser({ email: 'primary@example.com' });
      User.create.mockResolvedValue(newUser);
      UserRole.create.mockResolvedValue({});
      User.findByPk = jest.fn().mockResolvedValue({ ...newUser, roles: [{ name: 'GRANTEE' }] });

      const result = await AuthService.handleGithubCallback('valid-code');
      expect(result.user.email).toBe('primary@example.com');
    });
  });
});
