'use strict';

/**
 * Unit tests for UserService
 */

const { createMockUser } = require('../helpers');

jest.mock('../../src/models', () => ({
  User: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Role: {
    findOne: jest.fn(),
  },
  UserRole: {
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  Grant: {},
  Application: {},
}));

const UserService = require('../../src/services/UserService');
const { User, Role, UserRole } = require('../../src/models');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('should return all users', async () => {
      const users = [createMockUser(), createMockUser({ id: 'user-2' })];
      User.findAll.mockResolvedValue(users);

      const result = await UserService.listUsers();
      expect(result).toHaveLength(2);
    });
  });

  describe('getUserById', () => {
    it('should throw 404 if user not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(UserService.getUserById('non-existent')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should return user if found', async () => {
      const user = createMockUser();
      User.findByPk.mockResolvedValue(user);

      const result = await UserService.getUserById('user-id');
      expect(result).toEqual(user);
    });
  });

  describe('assignRole', () => {
    it('should throw 404 if user not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(UserService.assignRole('user-id', 'GRANTOR')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 404 if role not found', async () => {
      User.findByPk.mockResolvedValue(createMockUser());
      Role.findOne.mockResolvedValue(null);

      await expect(UserService.assignRole('user-id', 'INVALID_ROLE')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 409 if user already has the role', async () => {
      User.findByPk.mockResolvedValue(createMockUser());
      Role.findOne.mockResolvedValue({ id: 'role-id', name: 'GRANTOR' });
      UserRole.findOne.mockResolvedValue({});

      await expect(UserService.assignRole('user-id', 'GRANTOR')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('should assign role successfully', async () => {
      const mockUser = createMockUser();
      User.findByPk
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, roles: [{ id: 'role-id', name: 'GRANTOR' }] });
      Role.findOne.mockResolvedValue({ id: 'role-id', name: 'GRANTOR' });
      UserRole.findOne.mockResolvedValue(null);
      UserRole.create.mockResolvedValue({});

      const result = await UserService.assignRole('user-id', 'GRANTOR');
      expect(UserRole.create).toHaveBeenCalledWith({ user_id: 'user-id', role_id: 'role-id' });
      expect(result).toBeDefined();
    });
  });

  describe('removeRole', () => {
    it('should throw 404 if user not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(UserService.removeRole('user-id', 'GRANTOR')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 404 if role not found', async () => {
      User.findByPk.mockResolvedValue(createMockUser());
      Role.findOne.mockResolvedValue(null);

      await expect(UserService.removeRole('user-id', 'INVALID')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should throw 404 if user did not have the role', async () => {
      User.findByPk.mockResolvedValue(createMockUser());
      Role.findOne.mockResolvedValue({ id: 'role-id', name: 'GRANTOR' });
      UserRole.destroy.mockResolvedValue(0);

      await expect(UserService.removeRole('user-id', 'GRANTOR')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should remove role successfully', async () => {
      const mockUser = createMockUser();
      User.findByPk
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);
      Role.findOne.mockResolvedValue({ id: 'role-id', name: 'GRANTOR' });
      UserRole.destroy.mockResolvedValue(1);

      const result = await UserService.removeRole('user-id', 'GRANTOR');
      expect(UserRole.destroy).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('deactivateUser', () => {
    it('should throw 404 if user not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(UserService.deactivateUser('user-id')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should deactivate user successfully', async () => {
      const mockUser = createMockUser();
      User.findByPk.mockResolvedValue(mockUser);

      const result = await UserService.deactivateUser('user-id');
      expect(mockUser.update).toHaveBeenCalledWith({ is_active: false });
      expect(result.message).toContain('deactivated');
    });
  });
});
