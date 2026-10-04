'use strict';

const router = require('express').Router();
const ApplicationController = require('../controllers/ApplicationController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route GET /api/applications/my
 * @desc Get all applications submitted by the logged-in GRANTEE
 * @access GRANTEE only
 */
router.get(
  '/my',
  authenticate,
  authorize('GRANTEE'),
  ApplicationController.getMyApplications
);

/**
 * @route GET /api/applications/:appId
 * @desc Get a single application
 * @access The GRANTEE who submitted it or the GRANTOR of the parent grant
 */
router.get(
  '/:appId',
  authenticate,
  authorize('GRANTEE', 'GRANTOR', 'ADMIN'),
  ApplicationController.getApplication
);

/**
 * @route PATCH /api/applications/:appId/status
 * @desc Update application status
 * @access GRANTOR (only the one who owns the grant)
 */
router.patch(
  '/:appId/status',
  authenticate,
  authorize('GRANTOR'),
  ApplicationController.updateStatusValidation,
  ApplicationController.updateApplicationStatus
);

module.exports = router;
