'use strict';

const router = require('express').Router();
const UserController = require('../controllers/UserController');
const { authenticate, authorize } = require('../middleware/auth');

// All user management routes require authentication and ADMIN role
router.use(authenticate, authorize('ADMIN'));

/**
 * @route GET /api/users
 * @desc List all users
 * @access Admin only
 */
router.get('/', UserController.listUsers);

/**
 * @route GET /api/users/:userId
 * @desc Get a single user
 * @access Admin only
 */
router.get('/:userId', UserController.getUser);

/**
 * @route POST /api/users/:userId/roles
 * @desc Assign a role to a user
 * @access Admin only
 */
router.post(
  '/:userId/roles',
  UserController.assignRoleValidation,
  UserController.assignRole
);

/**
 * @route DELETE /api/users/:userId/roles/:roleName
 * @desc Remove a role from a user
 * @access Admin only
 */
router.delete('/:userId/roles/:roleName', UserController.removeRole);

/**
 * @route PATCH /api/users/:userId/deactivate
 * @desc Deactivate a user
 * @access Admin only
 */
router.patch('/:userId/deactivate', UserController.deactivateUser);

module.exports = router;
