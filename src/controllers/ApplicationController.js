'use strict';

const { body, param } = require('express-validator');
const ApplicationService = require('../services/ApplicationService');
const { validateRequest } = require('../middleware/errorHandler');

/**
 * ApplicationController - Handles application management requests
 */

/**
 * POST /api/grants/:grantId/apply
 * Submit an application for a grant (GRANTEE only)
 */
const applyForGrant = async (req, res, next) => {
  try {
    const { grantId } = req.params;
    const { proposal } = req.body;
    const granteeId = req.user.userId;

    const application = await ApplicationService.submitApplication(grantId, granteeId, proposal);

    return res.status(201).json({
      status: 'success',
      message: 'Application submitted successfully.',
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/applications/:appId
 * Get a single application (the grantee who submitted it or the grantor of the parent grant)
 */
const getApplication = async (req, res, next) => {
  try {
    const application = await ApplicationService.getApplicationById(
      req.params.appId,
      req.user.userId,
      req.user.roles
    );

    return res.status(200).json({
      status: 'success',
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/applications/my
 * Get all applications submitted by the logged-in grantee
 */
const getMyApplications = async (req, res, next) => {
  try {
    const applications = await ApplicationService.listMyApplications(req.user.userId);

    return res.status(200).json({
      status: 'success',
      data: applications,
      count: applications.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/applications/:appId/status
 * Update application status (Grantor of the grant)
 */
const updateApplicationStatus = async (req, res, next) => {
  try {
    const { appId } = req.params;
    const { status, reviewer_notes } = req.body;

    const application = await ApplicationService.updateApplicationStatus(
      appId,
      status,
      req.user.userId,
      reviewer_notes
    );

    return res.status(200).json({
      status: 'success',
      message: `Application status updated to '${status}'.`,
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

// Validation rules
const applyValidation = [
  param('grantId').isUUID().withMessage('Invalid grant ID format'),
  body('proposal').trim().notEmpty().withMessage('Proposal is required').isLength({ min: 10 }).withMessage('Proposal must be at least 10 characters long'),
  validateRequest,
];

const updateStatusValidation = [
  param('appId').isUUID().withMessage('Invalid application ID format'),
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['submitted', 'under_review', 'approved', 'rejected'])
    .withMessage('Status must be submitted, under_review, approved, or rejected'),
  body('reviewer_notes').optional().isString(),
  validateRequest,
];

module.exports = {
  applyForGrant,
  applyValidation,
  getApplication,
  getMyApplications,
  updateApplicationStatus,
  updateStatusValidation,
};
