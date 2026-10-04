'use strict';

const { body, param } = require('express-validator');
const UserService = require('../services/UserService');
const { validateRequest } = require('../middleware/errorHandler');

/**
 * UserController - Handles user management requests (Admin only)
 */

/**
 * GET /api/users
 * List all users (Admin only)
 */
const listUsers = async (req, res, next) => {
  try {
    const users = await UserService.listUsers();
    return res.status(200).json({
      status: 'success',
      data: users,
      count: users.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:userId
 * Get a single user (Admin only)
 */
const getUser = async (req, res, next) => {
  try {
    const user = await UserService.getUserById(req.params.userId);
    return res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/:userId/roles
 * Assign a role to a user (Admin only)
 */
const assignRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { roleName } = req.body;

    const updatedUser = await UserService.assignRole(userId, roleName);

    return res.status(200).json({
      status: 'success',
      message: `Role '${roleName}' assigned successfully.`,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/:userId/roles/:roleName
 * Remove a role from a user (Admin only)
 */
const removeRole = async (req, res, next) => {
  try {
    const { userId, roleName } = req.params;
    const updatedUser = await UserService.removeRole(userId, roleName);

    return res.status(200).json({
      status: 'success',
      message: `Role '${roleName}' removed successfully.`,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/:userId/deactivate
 * Deactivate a user (Admin only)
 */
const deactivateUser = async (req, res, next) => {
  try {
    const result = await UserService.deactivateUser(req.params.userId);
    return res.status(200).json({
      status: 'success',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// Validation rules
const assignRoleValidation = [
  param('userId').isUUID().withMessage('Invalid user ID format'),
  body('roleName')
    .notEmpty().withMessage('roleName is required')
    .isIn(['ADMIN', 'GRANTOR', 'GRANTEE']).withMessage('roleName must be ADMIN, GRANTOR, or GRANTEE'),
  validateRequest,
];

module.exports = {
  listUsers,
  getUser,
  assignRole,
  assignRoleValidation,
  removeRole,
  deactivateUser,
};
