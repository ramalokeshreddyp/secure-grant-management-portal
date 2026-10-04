'use strict';

const { User, Role, UserRole } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * UserService - Business logic for user management (Admin)
 */
class UserService {
  /**
   * List all users (Admin only)
   * @returns {Array} List of users with roles
   */
  async listUsers() {
    return User.findAll({
      include: [{ model: Role, as: 'roles', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Get a single user by ID
   * @param {string} userId
   * @returns {object} User with roles
   */
  async getUserById(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: 'roles', attributes: ['id', 'name'] }],
    });

    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    return user;
  }

  /**
   * Assign a role to a user (Admin only)
   * @param {string} userId - Target user ID
   * @param {string} roleName - Role name to assign
   * @returns {object} Updated user
   */
  async assignRole(userId, roleName) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    const role = await Role.findOne({ where: { name: roleName } });
    if (!role) {
      throw ApiError.notFound(`Role '${roleName}' does not exist. Valid roles: ADMIN, GRANTOR, GRANTEE.`);
    }

    // Check if already assigned
    const existing = await UserRole.findOne({
      where: { user_id: userId, role_id: role.id },
    });

    if (existing) {
      throw ApiError.conflict(`User already has the '${roleName}' role.`);
    }

    await UserRole.create({ user_id: userId, role_id: role.id });

    logger.info(`Role '${roleName}' assigned to user ${userId}`);

    // Return updated user with roles
    return this.getUserById(userId);
  }

  /**
   * Remove a role from a user (Admin only)
   * @param {string} userId
   * @param {string} roleName
   * @returns {object} Updated user
   */
  async removeRole(userId, roleName) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    const role = await Role.findOne({ where: { name: roleName } });
    if (!role) {
      throw ApiError.notFound(`Role '${roleName}' does not exist.`);
    }

    const deleted = await UserRole.destroy({
      where: { user_id: userId, role_id: role.id },
    });

    if (!deleted) {
      throw ApiError.notFound(`User does not have the '${roleName}' role.`);
    }

    logger.info(`Role '${roleName}' removed from user ${userId}`);
    return this.getUserById(userId);
  }

  /**
   * Deactivate a user (Admin only)
   * @param {string} userId
   */
  async deactivateUser(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    await user.update({ is_active: false });
    logger.info(`User deactivated: ${userId}`);
    return { message: 'User deactivated successfully.' };
  }
}

module.exports = new UserService();
