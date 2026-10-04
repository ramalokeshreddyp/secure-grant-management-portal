'use strict';

const { body, param, query } = require('express-validator');
const GrantService = require('../services/GrantService');
const { validateRequest } = require('../middleware/errorHandler');

/**
 * GrantController - Handles grant management requests
 */

/**
 * POST /api/grants
 * Create a new grant (GRANTOR only)
 */
const createGrant = async (req, res, next) => {
  try {
    const { title, description, amount, deadline, status } = req.body;
    const grantorId = req.user.userId;

    const grant = await GrantService.createGrant(
      { title, description, amount, deadline, status },
      grantorId
    );

    return res.status(201).json({
      status: 'success',
      message: 'Grant created successfully.',
      data: grant,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grants
 * List all grants (authenticated users)
 */
const listGrants = async (req, res, next) => {
  try {
    const { status } = req.query;
    const grants = await GrantService.listGrants({ status });

    return res.status(200).json({
      status: 'success',
      data: grants,
      count: grants.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grants/:grantId
 * Get a single grant (authenticated users)
 */
const getGrant = async (req, res, next) => {
  try {
    const grant = await GrantService.getGrantById(req.params.grantId);
    return res.status(200).json({
      status: 'success',
      data: grant,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/grants/:grantId
 * Update a grant (only the owning GRANTOR)
 */
const updateGrant = async (req, res, next) => {
  try {
    const grant = await GrantService.updateGrant(
      req.params.grantId,
      req.body,
      req.user.userId
    );

    return res.status(200).json({
      status: 'success',
      message: 'Grant updated successfully.',
      data: grant,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/grants/:grantId
 * Delete a grant (owner GRANTOR or ADMIN)
 */
const deleteGrant = async (req, res, next) => {
  try {
    const result = await GrantService.deleteGrant(
      req.params.grantId,
      req.user.userId,
      req.user.roles
    );

    return res.status(200).json({
      status: 'success',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/grants/:grantId/applications
 * Get applications for a grant (owning GRANTOR only)
 */
const getGrantApplications = async (req, res, next) => {
  try {
    const applications = await GrantService.getGrantApplications(
      req.params.grantId,
      req.user.userId
    );

    return res.status(200).json({
      status: 'success',
      data: applications,
      count: applications.length,
    });
  } catch (error) {
    next(error);
  }
};

// Validation rules
const createGrantValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ min: 3, max: 500 }),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('deadline').optional().isISO8601().withMessage('Deadline must be a valid ISO 8601 date'),
  body('status').optional().isIn(['open', 'closed', 'draft']).withMessage('Status must be open, closed, or draft'),
  validateRequest,
];

const updateGrantValidation = [
  param('grantId').isUUID().withMessage('Invalid grant ID format'),
  body('title').optional().trim().notEmpty().isLength({ min: 3, max: 500 }),
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('status').optional().isIn(['open', 'closed', 'draft']),
  validateRequest,
];

module.exports = {
  createGrant,
  createGrantValidation,
  listGrants,
  getGrant,
  updateGrant,
  updateGrantValidation,
  deleteGrant,
  getGrantApplications,
};
